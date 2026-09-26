import { ObjectId } from "mongodb";

export { };

declare global {
    interface ChatSettingsDocument {
        _id?: ObjectId;
        channelId: string;
        enabled: boolean;
        lastUpdated: Date;
    }
}
