export type EditorLanguage = "ru" | "en";

let activeLanguage: EditorLanguage = "ru";

export function editorLanguage(): EditorLanguage {
	return activeLanguage;
}

export function setEditorLanguage(language: EditorLanguage): void {
	activeLanguage = language;
}

export function copy<Russian extends string, English extends string>(russian: Russian, english: English): Russian | English {
	return activeLanguage === "ru" ? russian : english;
}
