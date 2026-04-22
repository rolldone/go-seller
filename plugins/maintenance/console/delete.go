package console

import (
	"bufio"
	"fmt"
	"math/rand/v2"
	"os"
	"strings"

	"go_framework/internal/db"
	"go_framework/plugins/maintenance/services"

	"github.com/spf13/cobra"
)

// numDigits controls how many digits the security challenge uses.
const numDigits = 6

// DeleteCmd returns the top-level "maintenance:delete" cobra command tree.
func DeleteCmd() *cobra.Command {
	root := &cobra.Command{
		Use:   "maintenance:delete",
		Short: "Force-delete data groups (DEVELOPMENT USE ONLY — irreversible)",
	}
	root.AddCommand(deleteOrdersCmd(), deleteCategoriesCmd(), deleteProductsCmd())
	return root
}

// ─── sub-commands ────────────────────────────────────────────────────────────

func deleteOrdersCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "orders",
		Short: "Hard-delete ALL orders, payments, carts, and related rows",
		RunE: func(cmd *cobra.Command, args []string) error {
			svc, err := newDeleteService()
			if err != nil {
				return err
			}

			count, err := svc.CountOrders()
			if err != nil {
				return err
			}

			fmt.Printf("\n⚠️  WARNING: This will permanently delete ALL orders and their related data.\n")
			fmt.Printf("   Tables affected: orders, order_items, payments, payment_gateway_histories,\n")
			fmt.Printf("   payment_proofs, order_transactions, order_coupons, order_discounts,\n")
			fmt.Printf("   carts, cart_items, wishlists, wishlist_items\n\n")
			fmt.Printf("   Total orders found: %d\n\n", count)

			if !confirmChallenge(cmd) {
				return nil
			}

			fmt.Printf("Deleting all orders...")
			if err := svc.PurgeAllOrders(); err != nil {
				return fmt.Errorf("purge failed: %w", err)
			}
			fmt.Printf(" done.\n")
			return nil
		},
	}
}

func deleteCategoriesCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "categories",
		Short: "Hard-delete ALL categories and their translations",
		RunE: func(cmd *cobra.Command, args []string) error {
			svc, err := newDeleteService()
			if err != nil {
				return err
			}

			count, err := svc.CountCategories()
			if err != nil {
				return err
			}

			fmt.Printf("\n⚠️  WARNING: This will permanently delete ALL categories.\n")
			fmt.Printf("   Tables affected: categories, category_translations\n\n")
			fmt.Printf("   Total categories found: %d\n\n", count)

			if !confirmChallenge(cmd) {
				return nil
			}

			fmt.Printf("Deleting all categories...")
			if err := svc.PurgeAllCategories(); err != nil {
				return fmt.Errorf("purge failed: %w", err)
			}
			fmt.Printf(" done.\n")
			return nil
		},
	}
}

func deleteProductsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "products",
		Short: "Hard-delete ALL products, variations, assets, and translations",
		RunE: func(cmd *cobra.Command, args []string) error {
			svc, err := newDeleteService()
			if err != nil {
				return err
			}

			count, err := svc.CountProducts()
			if err != nil {
				return err
			}

			fmt.Printf("\n⚠️  WARNING: This will permanently delete ALL products and their related data.\n")
			fmt.Printf("   Tables affected: products, product_translations, product_variations,\n")
			fmt.Printf("   product_assets, variation_attributes, variation_assets\n\n")
			fmt.Printf("   Total products found: %d\n\n", count)

			if !confirmChallenge(cmd) {
				return nil
			}

			fmt.Printf("Deleting all products...")
			if err := svc.PurgeAllProducts(); err != nil {
				return fmt.Errorf("purge failed: %w", err)
			}
			fmt.Printf(" done.\n")
			return nil
		},
	}
}

// ─── security challenge ───────────────────────────────────────────────────────

// confirmChallenge prints a random numeric code and requires the user to type
// it back verbatim before a destructive action is allowed. Returns true when
// the challenge is passed, false (and prints a message) when aborted.
func confirmChallenge(cmd *cobra.Command) bool {
	code := generateCode()
	fmt.Printf("Security challenge — type the number below to confirm, or Ctrl-C to abort.\n")
	fmt.Printf("  Code: %s\n> ", code)

	reader := bufio.NewReader(os.Stdin)
	input, err := reader.ReadString('\n')
	if err != nil {
		fmt.Printf("\nFailed to read input: %v\n", err)
		return false
	}
	input = strings.TrimSpace(input)

	if input != code {
		fmt.Printf("Input %q does not match %q — operation cancelled.\n", input, code)
		return false
	}
	return true
}

// generateCode returns a zero-padded random decimal string of length numDigits.
func generateCode() string {
	max := 1
	for i := 0; i < numDigits; i++ {
		max *= 10
	}
	n := rand.IntN(max) //nolint:gosec // not cryptographic — intentionally uses math/rand for a UX challenge
	return fmt.Sprintf("%0*d", numDigits, n)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func newDeleteService() (*services.DeleteService, error) {
	dbConn, err := db.GetGormDB()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	return services.NewDeleteService(dbConn), nil
}
