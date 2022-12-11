const data = {
    subscriptions: [
        {
            name: "SILVER",
            itsPopular: false,
            monthly_discount: {
                percent: 10,
                duration: "repeating",
                duration_in_months: 3,
            },
            yearly_discount: {
                percent: 15,
                duration: "repeating",
                duration_in_months: 36,
            },
            monthPrice: 6,
            yearPrice: 60,
            perks: ["500 showcase poster uploads.", "Up to 4 images per poster.", "Shop store and dashboard."],
        },
        {
            name: "GOLD",
            itsPopular: true,
            monthly_discount: {
                percent: 10,
                duration: "repeating",
                duration_in_months: 3,
            },
            yearly_discount: {
                percent: 15,
                duration: "repeating",
                duration_in_months: 36,
            },
            monthPrice: 9,
            yearPrice: 90,
            perks: ["800 showcase poster uploads.", "Up to 4 images per poster.", "Shop store and dashboard."],
        },
        {
            name: "PLATINUM",
            itsPopular: false,
            monthly_discount: {
                percent: 10,
                duration: "repeating",
                duration_in_months: 3,
            },
            yearly_discount: {
                percent: 15,
                duration: "repeating",
                duration_in_months: 36,
            },
            monthPrice: 12,
            yearPrice: 120,
            perks: ["1000 showcase poster uploads.", "Up to 4 images per poster.", "Shop store and dashboard."],
        },
    ],
};
export default data;
