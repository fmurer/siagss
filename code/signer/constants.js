// Different file paths
exports.SECRET_KEYPATH 			= __dirname + '/sk/';
exports.PUBLIC_KEYPATH 			= __dirname + '/pk/';
exports.LOG_FILE 				= __dirname + '/logs/signer.log';
exports.LOG_HASH 				= __dirname + '/logs/signer_log.hash';
exports.LOG_COUNTER_FILE		= __dirname + '/logs/log_counter';
exports.VERIFIER_PUB_KEY_FILE 	= exports.PUBLIC_KEYPATH + 'verifier_keys';

// Operations
exports.SIGN_REQUEST 			= 'Sign Request';
exports.INIT					= 'Signer Init';
exports.KEY_REP 				= 'Key Replication';
exports.LOG_VERIFY 				= 'Log Verification';
exports.NEW_KEY_PAIR 			= 'New Key Pair';
exports.STARTUP 				= 'Server Startup';

// Failures
exports.SIG_VERIF_FAIL 			= 'Signature Verification Failed';
exports.NUM_COMP_FAIL 			= 'Comparison Failed';
exports.CONSISTENCY_FAIL		= 'Consistency Check Failed';
exports.TIME_EXCEEDED 			= 'Time Limit Exceeded';
exports.DOUBLE_REG 				= 'Double Registration';
exports.DOUBLE_SUBMIT			= 'Double Submission';
exports.WRONG_ID				= 'No Such ID';

// Success
exports.SUCCESS 				= 'Success';