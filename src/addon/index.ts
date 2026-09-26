// import { SafeEval } from "./eval";
import { TimeHandler } from "./time";
import { TimeEventsHandler } from "./time_events";

export class AddonHandler {
    public timeObject?: TimeHandler;
    public timeEvents?: TimeEventsHandler;
    // public safeEval?: SafeEval;

    public startAddons() {
        this.timeObject = new TimeHandler();
        this.timeEvents = new TimeEventsHandler(this.timeObject);
        // this.safeEval = new SafeEval();
    }
}
