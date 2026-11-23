import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
	bundledLegalDocument,
	legalArchivePath,
	type LegalDocumentName,
} from "../app/legal-release";
import styles from "./legal-document-reader.module.css";

const documentNames: readonly LegalDocumentName[] = [
	"privacy-policy",
	"license-agreement",
	"analytics-consent",
];

export function closeActiveLegalDocument(): boolean {
	const back = document.querySelector<HTMLButtonElement>(
		"dialog[data-legal-reader][open] [data-legal-back]",
	);
	if (!back) return false;
	back.click();
	return true;
}

type ReadingPlace = { name: LegalDocumentName; scroll: number };
type ReaderProps = { first: LegalDocumentName; onClose: () => void };

function LegalReader({ first, onClose }: ReaderProps) {
	const [history, setHistory] = useState<ReadingPlace[]>([
		{ name: first, scroll: 0 },
	]);
	const current = history[history.length - 1];
	const dialog = useRef<HTMLDialogElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const save = useRef<HTMLAnchorElement>(null);
	const html = bundledLegalDocument(current.name);

	useLayoutEffect(() => {
		const element = dialog.current;
		element?.showModal();
		return () => element?.close();
	}, []);

	useLayoutEffect(() => {
		if (!html || !content.current || !dialog.current || !save.current) return;
		const article = new DOMParser()
			.parseFromString(html, "text/html")
			.querySelector("main");
		if (!article) return;
		const displayed = document.importNode(article, true);
		for (const link of displayed.querySelectorAll<HTMLAnchorElement>(
			"a[href]",
		)) {
			const target = documentNames.find(
				(name) => link.getAttribute("href") === `${name}.html`,
			);
			if (target) {
				link.href = legalArchivePath(target);
				link.onclick = (event) => {
					if (
						event.metaKey ||
						event.ctrlKey ||
						event.shiftKey ||
						event.altKey ||
						!bundledLegalDocument(target)
					)
						return;
					event.preventDefault();
					const scroll = dialog.current?.scrollTop ?? 0;
					setHistory((places) => [
						...places.slice(0, -1),
						{ name: current.name, scroll },
						{ name: target, scroll: 0 },
					]);
				};
			} else if (link.protocol === "https:" || link.protocol === "http:") {
				link.target = "_blank";
				link.rel = "noopener noreferrer";
			}
		}
		content.current.replaceChildren(displayed);
		const heading = content.current.querySelector("h1");
		if (heading) {
			heading.tabIndex = -1;
			heading.focus({ preventScroll: true });
		}
		dialog.current.scrollTop = current.scroll;
		const file = URL.createObjectURL(
			new Blob([html], { type: "text/html;charset=utf-8" }),
		);
		save.current.href = file;
		return () => URL.revokeObjectURL(file);
	}, [current, html]);

	const back = () => {
		if (history.length === 1) onClose();
		else setHistory((places) => places.slice(0, -1));
	};

	return createPortal(
		<dialog
			ref={dialog}
			data-legal-reader=""
			className={styles.reader}
			aria-label="Чтение документа"
			onCancel={(event) => {
				event.preventDefault();
				back();
			}}
		>
			<div className={styles.actions}>
				<button data-legal-back="" type="button" onClick={back}>
					Назад
				</button>
				<a
					ref={save}
					href={legalArchivePath(current.name)}
					download={`${current.name}.html`}
				>
					Сохранить HTML
				</a>
			</div>
			<div ref={content} />
		</dialog>,
		document.body,
	);
}

export function LegalDocumentLink({
	documentName,
	children,
}: {
	documentName: LegalDocumentName;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const trigger = useRef<HTMLAnchorElement>(null);
	return (
		<>
			<a
				href={legalArchivePath(documentName)}
				ref={trigger}
				onClick={(event) => {
					if (
						event.metaKey ||
						event.ctrlKey ||
						event.shiftKey ||
						event.altKey ||
						!bundledLegalDocument(documentName)
					)
						return;
					event.preventDefault();
					setOpen(true);
				}}
			>
				{children}
			</a>
			{open && (
				<LegalReader
					first={documentName}
					onClose={() => {
						setOpen(false);
						trigger.current?.focus({ preventScroll: true });
					}}
				/>
			)}
		</>
	);
}
