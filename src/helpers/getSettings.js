import Setting from "../models/settingModel.js";

const getSettings = async () => {
    try {
        let setting = await Setting.findOne();
        if (!setting) setting = await new Setting().save();

        return setting;
    } catch (error) {
        console.log(error);
    }
};

export default getSettings;
