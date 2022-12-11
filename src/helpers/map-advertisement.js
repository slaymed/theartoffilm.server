const mapAdvertisement = (advertisement, user) => {
    const remove = !user || advertisement.user.toString() !== user._id.toString();

    const ad = { ...advertisement.toJSON() };

    if (remove) delete ad.private_key;

    return ad;
};

export default mapAdvertisement;
