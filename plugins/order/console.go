package order

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"go_framework/internal/db"
	"go_framework/internal/secrets"
	"go_framework/plugins/order/models"

	"github.com/spf13/cobra"
)

func buildConsoleCommands() []*cobra.Command {
	helloCmd := &cobra.Command{
		Use:   "order:hello",
		Short: "hello from order",
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Printf("hello from plugin order\n")
		},
	}

	var providerKey string
	var dryRun bool

	reencryptCmd := &cobra.Command{
		Use:   "order:reencrypt-provider-credentials",
		Short: "Re-encrypt plaintext payment provider credentials",
		Run: func(cmd *cobra.Command, args []string) {
			if err := runReencryptProviderCredentials(providerKey, dryRun); err != nil {
				log.Fatalf("failed to re-encrypt provider credentials: %v", err)
			}
		},
	}
	reencryptCmd.Flags().StringVar(&providerKey, "provider-key", "", "optional provider_key filter")
	reencryptCmd.Flags().BoolVar(&dryRun, "dry-run", false, "show what would be changed without saving")

	return []*cobra.Command{helloCmd, reencryptCmd}
}

func runReencryptProviderCredentials(providerKey string, dryRun bool) error {
	gdb, err := db.GetGormDB()
	if err != nil {
		return err
	}

	q := gdb.WithContext(context.Background()).Model(&models.PaymentProvider{}).Where("deleted_at IS NULL")
	if strings.TrimSpace(providerKey) != "" {
		q = q.Where("provider_key = ?", strings.ToLower(strings.TrimSpace(providerKey)))
	}

	var providers []models.PaymentProvider
	if err := q.Find(&providers).Error; err != nil {
		return err
	}

	var scanned, updated, skippedEncrypted, skippedEmpty int
	for _, provider := range providers {
		scanned++
		if provider.CredentialsEncrypted == nil || strings.TrimSpace(*provider.CredentialsEncrypted) == "" {
			skippedEmpty++
			continue
		}
		if secrets.IsEncryptedBlob(strings.TrimSpace(*provider.CredentialsEncrypted)) {
			skippedEncrypted++
			continue
		}

		encrypted, err := secrets.EnsureEncryptedBlob(*provider.CredentialsEncrypted)
		if err != nil {
			return fmt.Errorf("provider %s (%s): %w", provider.ID, provider.ProviderKey, err)
		}
		if dryRun {
			fmt.Printf("[dry-run] would re-encrypt provider_id=%s provider_key=%s name=%q\n", provider.ID, provider.ProviderKey, provider.Name)
			continue
		}

		updates := map[string]any{
			"credentials_encrypted": encrypted,
			"updated_at":            time.Now(),
		}
		if err := gdb.WithContext(context.Background()).Model(&models.PaymentProvider{}).Where("id = ?", provider.ID).Updates(updates).Error; err != nil {
			return fmt.Errorf("provider %s (%s): update failed: %w", provider.ID, provider.ProviderKey, err)
		}
		updated++
		fmt.Printf("re-encrypted provider_id=%s provider_key=%s name=%q\n", provider.ID, provider.ProviderKey, provider.Name)
	}

	fmt.Printf("done scanned=%d updated=%d skipped_encrypted=%d skipped_empty=%d\n", scanned, updated, skippedEncrypted, skippedEmpty)
	return nil
}
