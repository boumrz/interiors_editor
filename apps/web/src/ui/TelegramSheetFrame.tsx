import { type ComponentPropsWithRef, createContext, useContext } from "react";
import { cancelNativeDialog, isDialogBackdrop, useBackdropDismiss } from "./backdrop-dismiss";
import styles from "./SheetHeader.module.css";

const SheetCloseContext = createContext<((close: () => void) => void) | undefined>(undefined);

export function useTelegramSheetClose() {
	return useContext(SheetCloseContext);
}

type SheetOptions = {
	readonly telegram?: boolean;
	readonly compact?: boolean;
	readonly canvasAnchored?: boolean;
	readonly busy?: boolean;
};

type FrameProps = SheetOptions & (
	| ({ readonly as: "dialog"; readonly onBackdropClose?: () => void } & ComponentPropsWithRef<"dialog">)
	| ({ readonly as?: "aside" } & ComponentPropsWithRef<"aside">)
);

export function TelegramSheetFrame({
	telegram = false,
	compact = false,
	canvasAnchored = false,
	busy = false,
	children,
	className,
	...elementProps
}: FrameProps) {
	const onBackdropClose = elementProps.as === "dialog" ? elementProps.onBackdropClose : undefined;
	const backdrop = useBackdropDismiss(isDialogBackdrop, busy ? undefined : onBackdropClose ?? cancelNativeDialog);
	const allowClose = (close: () => void) => { if (!busy) close(); };
	const shell = !telegram ? className : canvasAnchored
		? `${className ?? ""} ${styles.canvasSheet}`
		: `${className ?? ""} ${styles.dialog} ${styles.telegramDialog}`;
	const frameProps = {
		className: shell,
		"data-telegram-bottom-sheet": telegram ? (compact || canvasAnchored ? "compact" : "full") : undefined,
	};
	const content = (
		<SheetCloseContext.Provider value={telegram ? allowClose : undefined}>
			{children}
		</SheetCloseContext.Provider>
	);
	if (elementProps.as === "dialog") {
		const { as: _as, onBackdropClose: _onBackdropClose, ...dialog } = elementProps;
		return <dialog {...dialog} {...frameProps} {...(telegram ? backdrop : {})}>{content}</dialog>;
	}
	const { as: _as, ...aside } = elementProps;
	return <aside {...aside} {...frameProps}>{content}</aside>;
}
