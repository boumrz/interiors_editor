# Readonly Telegram projects leaf

Import `TelegramReadonlyProjects` from `src/ui/telegram-readonly-projects`. This is a UI leaf; the composition owns actual loaded-shell/readable admission, fresh verified scope, runtime lifecycle, and storage.

The structural runtime needs only `signal: AbortSignal`, `sourceRecovery: ProjectSourceRecoveryPort`, `listProjects(): Promise<ProjectDirectoryResult>`, and `exportProjectTransfer(projectId, expectedRevisionId, {signal?}?): Promise<ExportPortableBackupResult>`. No controller, storage owner, scope, SDK global, importer or legacy serializer is accepted. Root's actual readonly runtime is structurally assignable.

Props: runtime; optional fileTransfer, diagnostics ReactNode, hostNavigation; required onRetry/onExit; optional onProblem accepts only source-unavailable |backup-unavailable |file-unavailable. Root MUST fence Retry/Exit by the actual private current-runtime identity. Buttons remain available for an aborted CURRENT runtime; they do not revive it.

Each committed effect creates a fresh permanent-close UI session. Construction is inert; the first deferred auto-list starts only after signal subscription and only while owned. StrictMode's first cleanup suppresses its queued read. Owner A→B→A creates fresh identities. Runtime abort synchronously closes the LocalFileTransferSession, revokes guarded source reads, drops late query/export results and hides prepared files. UI disposal does not dispose the actual runtime: Root owns its full native drain.

Healthy names/addresses are copied from the validated directory. Only the exact listed projectId/revisionId pair may prepare a full file. Preparation does not call handoff. The existing LocalFileTransferPanel requires a separate fresh gesture; its result remains handoff-attempted, not saved. Raw-tier addresses use the unchanged StoredSourceRecovery list/select flow. A source ticket binds the exact returned strings to that UI intent; an older raw read cannot replace a newer prepared Project file. Raw packaging uses unchanged prepareUnverifiedSourceFile and fileKind unverified-source. No file can choose a scope or storage owner.

Host Back calls the owner-fenced Exit. Closing confirmation defaults false because this view has no drafts; optional host failures do not disable other Back capabilities. Back subscription revokes before potentially reentrant teardown.

Accessible labels: heading Просмотр проектов; healthy region Проверенные записи; row action Подготовить файл проекта. Existing delivery panel Передача файла, second action Передать файл, then Проверьте файл вне приложения. Raw tier Непроверенные исходники /Показать записи /Подготовить исходник записи N. Empty is explicitly нет проверенных проектов; unavailable is a distinct state.

CSS reads current canvas/surface/ink/line tokens and safe-area/stable-viewport variables. Filled controls use the canonical editor-host-primary-fill /editor-host-on-primary pair. Default/current browser CSS, package/config, entry, AppShell, existing native harnesses and all storage are untouched.
