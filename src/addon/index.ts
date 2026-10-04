// import { SafeEval } from "./eval";
import { EmbedBuilders } from "./embeds";
import { TimeHandler } from "./time";
import { TimeEventsHandler } from "./time_events";

export class AddonHandler {
    public timeObject?: TimeHandler;
    public timeEvents?: TimeEventsHandler;
    public embedBuilders?: EmbedBuilders;
    // public safeEval?: SafeEval;

    public startAddons() {
        this.timeObject = new TimeHandler();
        this.timeEvents = new TimeEventsHandler(this.timeObject);
        this.embedBuilders = new EmbedBuilders();
        // this.safeEval = new SafeEval();
    }
}
