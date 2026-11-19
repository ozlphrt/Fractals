const SCALES = [1, 0.9, 0.82, 0.7, 0.6];

export class RenderQuality {
    constructor() {
        this.index = 0;
        this.frameTimes = [];
        this.overBudget = 0;
        this.underBudget = 0;
    }

    update(frameMs, gpuMs, doublePass) {
        // Ignore tab suspension when accumulating time at either threshold.
        const interval = Math.min(100, frameMs);
        this.frameTimes.push(interval);
        if (this.frameTimes.length > 30) this.frameTimes.shift();
        const average = this.frameTimes.reduce((sum, sample) => sum + sample, 0) / this.frameTimes.length;

        if (average > 19.5) {
            this.overBudget += interval;
            this.underBudget = 0;
            if (this.overBudget >= 400) {
                this.index = Math.min(SCALES.length - 1, this.index + 1);
                this.overBudget = 0;
            }
        } else if (!doublePass && average < 18 && (gpuMs > 0 ? gpuMs < 11.5 : average < 14)) {
            this.underBudget += interval;
            this.overBudget = 0;
            if (this.underBudget >= 1500) {
                this.index = Math.max(0, this.index - 1);
                this.underBudget = 0;
            }
        } else {
            this.overBudget = 0;
            this.underBudget = 0;
        }

        return SCALES[Math.max(this.index, doublePass ? 1 : 0)];
    }
}
