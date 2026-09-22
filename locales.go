package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"slices"
	"strings"
)

//go:embed locales/*.json
var localeFiles embed.FS

// fallbackLanguage is used when a request names no supported language; the
// static pages are written in it.
const fallbackLanguage = "en"

// interfaceLocale is one locales/<lang>.json catalog, shared with the SPA.
type interfaceLocale struct {
	lang     string
	messages map[string]string
}

func (l interfaceLocale) message(id string) string {
	return l.messages[id]
}

// interfaceLocales holds every catalog, the fallback first.
var interfaceLocales = mustLoadInterfaceLocales(localeFiles)

func mustLoadInterfaceLocales(fsys fs.FS) []interfaceLocale {
	locales, err := loadInterfaceLocales(fsys)
	if err != nil {
		panic(err)
	}

	return locales
}

func loadInterfaceLocales(fsys fs.FS) ([]interfaceLocale, error) {
	names, err := fs.Glob(fsys, "locales/*.json")
	if err != nil {
		return nil, err
	}

	var locales []interfaceLocale
	for _, name := range names {
		// The directory is also the SPA's workspace package.
		if path.Base(name) == "package.json" {
			continue
		}

		data, err := fs.ReadFile(fsys, name)
		if err != nil {
			return nil, err
		}

		var messages map[string]string
		if err := json.Unmarshal(data, &messages); err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		locales = append(locales, interfaceLocale{
			lang:     strings.TrimSuffix(path.Base(name), ".json"),
			messages: messages,
		})
	}

	slices.SortFunc(locales, func(a, b interfaceLocale) int {
		switch {
		case a.lang == b.lang:
			return 0
		case a.lang == fallbackLanguage:
			return -1
		case b.lang == fallbackLanguage:
			return 1
		default:
			return strings.Compare(a.lang, b.lang)
		}
	})
	if len(locales) == 0 || locales[0].lang != fallbackLanguage {
		return nil, fmt.Errorf("locales/%s.json is missing", fallbackLanguage)
	}

	return locales, nil
}

func interfaceLanguages() []string {
	langs := make([]string, 0, len(interfaceLocales))
	for _, locale := range interfaceLocales {
		langs = append(langs, locale.lang)
	}

	return langs
}
