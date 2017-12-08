var scheduler = require('node-schedule');


seconds = [];

for (var i =  0; i<60; i++) {
	seconds[i] = i;
}

num_per_sec = 8;

scheduler.scheduleJob({second: seconds}, () => {
	console.log(new Date());
	
	step = 1000/num_per_sec;

	for (var i = 0; i < num_per_sec; i++) {
		time = step + i*step;
		setTimeout(() => {
			console.log(new Date());
		}, time);
	}

});