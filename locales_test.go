package main

import (
	"os"
	"slices"
	"strings"
	"testing"
	"testing/fstest"
)

func TestInterfaceLocales_LoadsEveryCatalogWithPageMessages(t *testing.T) {
	if got := interfaceLanguages(); len(got) < 2 || got[0] != fallbackLanguage || !slices.Contains(got, "ja") {
		t.Fatalf("expected %q first and ja among the languages, got %v", fallbackLanguage, got)
	}

	for _, locale := range interfaceLocales {
		for _, id := range []string{"document.title", "document.description", "document.ogLocale"} {
			if locale.message(id) == "" {
				t.Errorf("locales/%s.json has no %q", locale.lang, id)
			}
		}
	}
}

func TestLoadInterfaceLocales_RequiresTheFallback(t *testing.T) {
	fsys := fstest.MapFS{
		"locales/ja.json": {Data: []byte(`{"document.title": "タイトル"}`)},
	}

	if _, err := loadInterfaceLocales(fsys); err == nil {
		t.Fatal("expected an error without the fallback catalog")
	}
}

func TestInterfaceLocales_AreAllExportedToTheSPA(t *testing.T) {
	index, err := os.ReadFile("locales/index.ts")
	if err != nil {
		t.Fatal(err)
	}

	for _, lang := range interfaceLanguages() {
		if !strings.Contains(string(index), `"./`+lang+`.json"`) {
			t.Errorf("locales/index.ts does not import %s.json, so the SPA cannot offer it", lang)
		}
	}
}

func TestLoadInterfaceLocales_SkipsThePackageManifest(t *testing.T) {
	fsys := fstest.MapFS{
		"locales/en.json":      {Data: []byte(`{"document.title": "Title"}`)},
		"locales/package.json": {Data: []byte(`{"name": "locales", "exports": {".": "./index.ts"}}`)},
	}

	locales, err := loadInterfaceLocales(fsys)
	if err != nil || len(locales) != 1 {
		t.Fatalf("expected only the en catalog, got %v (%v)", locales, err)
	}
}
