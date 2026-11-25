import { copy } from "./editor-language";
/** Text shown immediately before an irreversible Project deletion. */
export function projectDeletionTargetText(projectName: string): string {
	return copy(
		`Будет безвозвратно удалён проект «${projectName}».`,
		`The project “${projectName}” will be permanently deleted.`,
	);
}
