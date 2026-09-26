import EventEmitter from "events";
import { TimeHandler } from "./time";

export const TimeEvents: TimeEventEmitter = new EventEmitter();

export type TimeEventNames = "time:1m" | "time:5m" | "time:15m" | "time:30m" | "time:1h" | "time:1d" | "time:am" | "time:pm" | "time:1w" | "time:1mo" | "time:1y";

export interface TimeEventEmitter extends EventEmitter {
    on(event: TimeEventNames, listener: (time: TimeHandler) => void): this,
    once(event: TimeEventNames, listener: (time: TimeHandler) => void): this,
    emit(event: TimeEventNames, time: TimeHandler): boolean
}

export class TimeEventsHandler {
    public timeEvents: TimeEventEmitter = new EventEmitter();
    private oneMinuteCD: boolean = false;
    private timeObject: TimeHandler;
    private oneMinuteInterval?: NodeJS.Timeout;

    public constructor(timeHandler: TimeHandler) {
        this.timeObject = timeHandler;
        this.checkOneMinute();
        this.emitTimeEvents();
    }

    private emitTimeEvents() {
        this.timeEvents.on("time:1m", (time) => {
            if (this.timeObject.minute % 5 == 0) this.timeEvents.emit("time:5m", time); // 5m
            if (this.timeObject.minute % 15 == 0) this.timeEvents.emit("time:15m", time); // 15m
            if (this.timeObject.minute % 30 == 0) this.timeEvents.emit("time:30m", time); // 30m
            if (this.timeObject.minute == 0) this.timeEvents.emit("time:1h", time); // 1h
        });
        this.timeEvents.on("time:1h", (time) => {
            if (this.timeObject.hour == 0) {
                this.timeEvents.emit("time:1d", time); this.timeEvents.emit("time:am", time);
            } // new day + am
            if (this.timeObject.hour == 12) this.timeEvents.emit("time:pm", time); // pm
        });
        this.timeEvents.on("time:1d", (time) => {
            if (this.timeObject.weekDay == 1) this.timeEvents.emit("time:1w", time); // 1week
            if (this.timeObject.day == 1) this.timeEvents.emit("time:1mo", time); // 1month
        });
        this.timeEvents.on("time:1mo", (time) => {
            if (this.timeObject.month == 1) this.timeEvents.emit("time:1y", time); // 1year
        });
    }

    private checkOneMinute() {
        this.oneMinuteInterval = setInterval(() => {
            if (this.timeObject.second <= 1 && !this.oneMinuteCD) {
                this.timeEvents.emit("time:1m", this.timeObject);
                this.oneMinuteCD = true;
                setTimeout(() => {
                    this.oneMinuteCD = false;
                }, 10000);
            }
        }, 100); /* 0.1s*/
    }

}
