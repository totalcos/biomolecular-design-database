import axios from 'axios';

export function uploadFiles(files) {
	return dispatch => {
		return axios.post('/api/upload', files);
	};
}  