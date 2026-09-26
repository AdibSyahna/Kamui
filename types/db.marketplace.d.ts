export { };
import { WithId } from "mongodb";

declare global {
    type DatabaseMarketplace = WithId<{
        familyFame: string
    }>;
}