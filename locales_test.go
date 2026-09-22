package main

import (
	"slices"
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
