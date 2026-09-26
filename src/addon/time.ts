export class TimeHandler {
    public utc = "UTC +0";
    public time = 0;
    public milliSecond = 0;
    public second = 0;
    public minute = 0;
    public hour = 0;
    public AmPm: "AM" | "PM" = "AM";
    public day = 0;
    public weekDay = 0;
    public dateSuffix = <"st" | "nd" | "rd" | "th">"st";
    public month = 0;
    public year = 0;
    public monthName = "January";
    public dayName = "Sunday";

    public constructor() {
        this.runTime();
    }

    private runTime() {
        let nameOfTheMonth = "", nameOfTheDay = "", suffix = <"st" | "nd" | "rd" | "th">"", AMpm = <"AM" | "PM">"";
        switch (new Date().getMonth()) {
            case 0: nameOfTheMonth = "January"; break;
            case 1: nameOfTheMonth = "February"; break;
            case 2: nameOfTheMonth = "March"; break;
            case 3: nameOfTheMonth = "April"; break;
            case 4: nameOfTheMonth = "May"; break;
            case 5: nameOfTheMonth = "June"; break;
            case 6: nameOfTheMonth = "July"; break;
            case 7: nameOfTheMonth = "August"; break;
            case 8: nameOfTheMonth = "September"; break;
            case 9: nameOfTheMonth = "October"; break;
            case 10: nameOfTheMonth = "November"; break;
            case 11: nameOfTheMonth = "December"; break;
        }
        switch (new Date().getDay()) {
            case 0: nameOfTheDay = "Sunday"; break;
            case 1: nameOfTheDay = "Monday"; break;
            case 2: nameOfTheDay = "Tuesday"; break;
            case 3: nameOfTheDay = "Wednesday"; break;
            case 4: nameOfTheDay = "Thursday"; break;
            case 5: nameOfTheDay = "Friday"; break;
            case 6: nameOfTheDay = "Saturday"; break;
        }

        const UTC = Math.floor(new Date().getTimezoneOffset() / 60) * -1;
        this.utc = `UTC ${UTC >= 0 ? "+" : ""}${UTC}`;
        this.milliSecond = new Date().getMilliseconds();
        this.second = new Date().getSeconds();
        this.minute = new Date().getMinutes();
        this.hour = new Date().getHours();

        if (this.hour >= 12) AMpm = "PM";
        else AMpm = "AM";
        this.AmPm = AMpm;

        this.day = new Date().getDate();
        this.weekDay = new Date().getDay();
        if (this.day <= 10 && this.day >= 20 && this.day % 10 == 1) suffix = "st";
        else if (this.day <= 10 && this.day >= 20 && this.day % 10 == 2) suffix = "nd";
        else if (this.day <= 10 && this.day >= 20 && this.day % 10 == 3) suffix = "rd";
        else suffix = "th";

        this.dateSuffix = suffix;
        this.month = new Date().getMonth() + 1;
        this.year = new Date().getFullYear();
        this.monthName = nameOfTheMonth;
        this.dayName = nameOfTheDay;
        this.time = new Date().getTime();
    }
}
