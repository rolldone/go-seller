package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"go_framework/internal/db"
	"go_framework/internal/storage"
	"go_framework/internal/uuid"
	catalogmodels "go_framework/plugins/catalog/models"
	catalogservices "go_framework/plugins/catalog/services"

	"gorm.io/gorm"
)

type categoryItem struct {
	Index        int     `json:"index"`
	TempID       string  `json:"temp_id"`
	ParentIndex  *int    `json:"parent_index"`
	SortPriority int     `json:"sort_priority"`
	IconURL      *string `json:"icon_url"`
}

type translationRow struct {
	Name             string  `json:"name"`
	Slug             string  `json:"slug"`
	ShortDescription *string `json:"short_description"`
	Description      *string `json:"description"`
}

// ImportCategoriesFromFile imports categories JSON into the catalog using GORM.
func ImportCategoriesFromFile(ctx context.Context, filePath string) error {
	if filePath == "" {
		return errors.New("file path required")
	}

	// read categories
	b, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read categories file: %w", err)
	}
	var items []categoryItem
	if err := json.Unmarshal(b, &items); err != nil {
		return fmt.Errorf("parse categories json: %w", err)
	}

	dir := filepath.Dir(filePath)

	// load translations (prefer en, fallback id)
	trans := map[string]translationRow{}
	tryFiles := []string{"categories.translations.en.json", "categories.translations.id.json"}
	for _, tf := range tryFiles {
		p := filepath.Join(dir, tf)
		if _, err := os.Stat(p); err == nil {
			tb, _ := os.ReadFile(p)
			_ = json.Unmarshal(tb, &trans)
			break
		}
	}

	// load id map if present (index -> uuid)
	idMap := map[string]string{}
	idMapPath := filepath.Join(dir, "categories_id_map.json")
	if _, err := os.Stat(idMapPath); err == nil {
		tb, _ := os.ReadFile(idMapPath)
		_ = json.Unmarshal(tb, &idMap)
	}

	// init DB and store
	gdb, err := db.GetGormDB()
	if err != nil {
		return fmt.Errorf("connect db: %w", err)
	}

	var store storage.Store
	if cfg, err := storage.LoadConfig(); err == nil {
		if s, err := storage.NewStore(cfg); err == nil {
			store = s
		}
	}

	catSvc := catalogservices.New(gdb, store)

	// map index->item for deterministic iteration
	itemsByIndex := map[int]categoryItem{}
	for _, it := range items {
		itemsByIndex[it.Index] = it
	}

	created := map[int]string{}
	total := len(items)

	// helper to compute slug (same logic as catalog services)
	makeSlug := func(input string) string {
		s := strings.ToLower(strings.TrimSpace(input))
		// replace non a-z0-9 with -
		var b strings.Builder
		prevDash := false
		for _, r := range s {
			c := r
			if c >= 'a' && c <= 'z' || (c >= '0' && c <= '9') {
				b.WriteRune(c)
				prevDash = false
				continue
			}
			if !prevDash {
				b.WriteRune('-')
				prevDash = true
			}
		}
		out := strings.Trim(b.String(), "-")
		if out == "" {
			return "product"
		}
		return out
	}

	// iterative create respecting parent dependencies
	remaining := total
	for remaining > 0 {
		progressed := false
		for _, it := range items {
			if _, ok := created[it.Index]; ok {
				continue
			}

			// resolve parent id if any
			var parentID *string
			if it.ParentIndex != nil {
				pid := *it.ParentIndex
				// check created map
				if id, ok := created[pid]; ok {
					parentID = &id
				} else if mid, ok := idMap[strconv.Itoa(pid)]; ok {
					// parent might already exist in DB
					var p catalogmodels.Category
					if err := gdb.WithContext(ctx).Where("id = ?", mid).First(&p).Error; err == nil {
						created[pid] = mid
						parentID = &mid
					} else {
						// parent not yet created, skip
						continue
					}
				} else {
					// parent not created and no mapping, skip
					continue
				}
			}

			// determine ID
			var idStr string
			if v, ok := idMap[strconv.Itoa(it.Index)]; ok && v != "" {
				idStr = v
			} else {
				idStr, _ = uuid.New()
			}

			// get translations
			tkey := strconv.Itoa(it.Index)
			tr, _ := trans[tkey]
			name := tr.Name
			if name == "" {
				// fallback to temp id
				name = it.TempID
			}

			var shortDesc *string
			if tr.ShortDescription != nil {
				shortDesc = tr.ShortDescription
			}

			cat := &catalogmodels.Category{
				ID:               idStr,
				ParentID:         parentID,
				Name:             name,
				ShortDescription: shortDesc,
				IconURL:          it.IconURL,
				SortPriority:     it.SortPriority,
			}

			// check existing by id
			var existing catalogmodels.Category
			if err := gdb.WithContext(ctx).Where("id = ?", idStr).First(&existing).Error; err == nil {
				// update
				existing.Name = cat.Name
				existing.ParentID = cat.ParentID
				existing.ShortDescription = cat.ShortDescription
				existing.IconURL = cat.IconURL
				existing.SortPriority = cat.SortPriority
				if err := catSvc.UpdateCategory(ctx, &existing); err != nil {
					return fmt.Errorf("update category %d: %w", it.Index, err)
				}
				created[it.Index] = existing.ID
				remaining--
				progressed = true
				continue
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("lookup category by id: %w", err)
			}

			// check existing by slug (generate candidate)
			slugCandidate := makeSlug(name)
			if err := gdb.WithContext(ctx).Where("slug = ?", slugCandidate).First(&existing).Error; err == nil {
				existing.Name = cat.Name
				existing.ParentID = cat.ParentID
				existing.ShortDescription = cat.ShortDescription
				existing.IconURL = cat.IconURL
				existing.SortPriority = cat.SortPriority
				if err := catSvc.UpdateCategory(ctx, &existing); err != nil {
					return fmt.Errorf("update category by slug %d: %w", it.Index, err)
				}
				created[it.Index] = existing.ID
				remaining--
				progressed = true
				continue
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("lookup category by slug: %w", err)
			}

			// create new
			if cat.Slug == "" {
				// leave slug empty; CreateCategory will create from Name
			}
			if err := catSvc.CreateCategory(ctx, cat); err != nil {
				return fmt.Errorf("create category %d: %w", it.Index, err)
			}
			created[it.Index] = cat.ID
			remaining--
			progressed = true
		}
		if !progressed {
			return fmt.Errorf("could not make progress creating categories; possible missing parents or cycle")
		}
	}

	// done
	_ = time.Now()
	return nil
}
