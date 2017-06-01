import React from 'react';
import './Home.css';

import i1 from '../../../public/Assets/BDDSampleFiles/AutodeskALogo_V2.png';


const GalleryItem = ({project}) => {
	const qod = project.quality_of_documentation;
	var ticks = [];
	for(var i = 0; i < 5; i++){
		if( i < qod){
			ticks.push(<span className='green-tick glyphicon glyphicon-ok-circle' aria-hidden='true'></span>);
		}
		else{
			ticks.push(<span className='glyphicon glyphicon-ok-circle' aria-hidden='true'></span>);
		}
	}

	return (
		<div className="col-lg-3 col-md-4 col-xs-6 showcase-item-layout">
	        
	      	<img className="img-responsive project-image" src={i1} alt=""/>
	        <h4 className="project-item-title">{project.name}</h4>
	        <p className="authors-styling">{project.authors}</p>
	        <hr/>

	        <div className="tick">
		        {ticks[0]}
		        {ticks[1]}
		        {ticks[2]}
		        {ticks[3]}
		        {ticks[4]}
	        </div>
	  
    	    <div className="stats"> 
	  	       	<i className="fa fa-thumbs-o-up" aria-hidden="true"></i>{project.likes}
	           	<i className="fa fa-eye" aria-hidden="true"> </i>{project.views}
            </div>
	    </div>
	  
	);
}

GalleryItem.propTypes = {
	project: React.PropTypes.object.isRequired
}



export default GalleryItem;