import { logger } from './logger';



export const createDummyRoomsForFun = async (janus, amount) => {

	for(let i = 0; i < amount; i++) {
		logger.info(`creating room ${i + 1}...`);
		const result = await janus.createRoom({
			load: {
				description: i%2 ? `Cool vp8 room (${i})` : `Cool vp9 room (${i})`,
				bitrate: 512000,
				bitrate_cap: false,
				fir_freq: undefined,
				videocodec: i===0 ? "vp8" : "vp9",
				vp9_profile: i===0 ? undefined : "1",
				permanent: true
			}
		});
		logger.info(`creating room ${i + 1} result...`);
		console.log(result.load);
		//const id = result.load.context.room_id;
		logger.info(`room ${i + 1} created...`);
		logger.json(result);
	}

};