export const setAllowed = (req, res, next) => {

    res.header("Access-Control-Allow-Origin", "*");

    res.header("Access-Control-Allow-Methods", "HEAD, PUT, POST, GET, OPTIONS, DELETE");

    res.header("Access-Control-Allow-Headers", "origin, content-type, Authorization, x-access-token");

    if (req.method === "OPTIONS") {
        return res
            .status(405)
            .send()
            .end();
    } else {
        next();
	}
	
};