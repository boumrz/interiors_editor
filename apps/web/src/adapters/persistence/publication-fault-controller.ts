export type PublicationFaultPoint = 'before-pointer' | 'before-pointer-quota';

export class PublicationFaultController {
	private delayMilliseconds = 0;
	private pauseAfterPinStagingMark = false;
	private releasePinStagingMarkPause: (() => void) | undefined;
	private fault: PublicationFaultPoint | undefined;

  public setDelay(milliseconds: number): void {
    this.delayMilliseconds = Math.max(0, Math.floor(milliseconds));
  }

	public setFault(point: PublicationFaultPoint): void {
		this.fault = point;
	}

	/** Test seam for the crash window after the journal commits but before publish. */
	public pausePinStagingMark(): void {
		this.pauseAfterPinStagingMark = true;
	}

	public releasePinStagingMark(): void {
		this.pauseAfterPinStagingMark = false;
		this.releasePinStagingMarkPause?.();
		this.releasePinStagingMarkPause = undefined;
	}

  public async beforeStaging(): Promise<void> {
    if (this.delayMilliseconds > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, this.delayMilliseconds));
    }
  }

	public beforePointer(): void {
    if (this.fault === 'before-pointer') {
      this.fault = undefined;
      throw new Error('Controlled persistence fault before pointer publication');
    }
    if (this.fault === 'before-pointer-quota') {
      this.fault = undefined;
		const error = new Error('Controlled quota fault before pointer publication');
		error.name = 'QuotaExceededError';
		throw error;
		}
	}

	public async afterPinStagingMark(): Promise<void> {
		if (!this.pauseAfterPinStagingMark) return;
		await new Promise<void>((resolve) => {
			this.releasePinStagingMarkPause = resolve;
		});
	}
}
