package console

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"

	"github.com/spf13/cobra"
)

// S2SCommands returns console commands for generating server-to-server shared keys.
func S2SCommands() []*cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth:s2s-key",
		Short: "Generate a new S2S_KEY for encrypted server-to-server callbacks",
		Run: func(cmd *cobra.Command, args []string) {
			key := make([]byte, 32)
			if _, err := rand.Read(key); err != nil {
				log.Fatalf("failed to generate S2S key: %v", err)
			}

			encoded := base64.StdEncoding.EncodeToString(key)
			fmt.Println("S2S_KEY generated (displayed once):")
			fmt.Println(encoded)
			fmt.Println("Set this value to S2S_KEY in Go server and frontend-SSR environment.")
		},
	}

	return []*cobra.Command{cmd}
}
