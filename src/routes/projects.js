import express from 'express';
import Projects from '../models/projects';
import Files from '../models/files';
import AWS from 'aws-sdk';
import commaSplit from 'comma-split';
import Comments from '../models/comments';
import config from '../config';
import jwt from 'jsonwebtoken';
import count from 'word-count';

const s3 = new AWS.S3();
let router = express.Router();
const bucketName = 'bionano-bdd-app';

function getSignedUrl(projects) {
  return projects.map((project) => {
    const keyName = project.header_image_link;
    const params = {
      Bucket: bucketName,
      Key: keyName,
      Expires: 1800
    };
    s3.getSignedUrl('getObject', params, (err, url) => {
      project.header_image_link = url;
    });
    if (project.hero_image !== null) {
      const keyName1 = project.hero_image;
      const params1 = {
        Bucket: bucketName,
        Key: keyName1,
        Expires: 1800
      };
      s3.getSignedUrl('getObject', params1, (err, url) => {
        project.hero_image = url;
      });
    }
    return project;
  });
}

function singleSignedUrl(project) {
  const keyName = project.header_image_link;
  const params = {
    Bucket: bucketName,
    Key: keyName,
    Expires: 3600
  };

  project.headerImageLinkOnS3 = keyName;
  s3.getSignedUrl('getObject', params, (err, url) => {
    project.header_image_link = url;
  });

  if (project.hero_image !== null) {
    const keyName1 = project.hero_image;
    project.heroImageLinkOnS3 = keyName1;
    const params1 = {
      Bucket: bucketName,
      Key: keyName1,
      Expires: 3600
    };
    s3.getSignedUrl('getObject', params1, (err, url) => {
      project.hero_image = url;
    });
  }
  return project;
}

function nameSearch(project, search) {
  return project.name.toLowerCase().indexOf(search) !== -1;
}

function keywordsSearch(project, search) {
  return project.keywords.toString().toLowerCase().indexOf(search) !== -1;
}

function authorsSearch(project, search) {
  return project.authors.toString().toLowerCase().indexOf(search) !== -1;
}

function applySearch(projects, search) {
  const resData = [];
  const projectLen = projects.length;
  if (search) {
    search = search.toLowerCase();
    const wordsArr = commaSplit(search);
    const wordsArrLen = wordsArr.length;
    for (let j = 0; j < projectLen; j++) {
      let toAppend = true;
      for (let k = 0; k < wordsArrLen; k++) {
        if (!nameSearch(projects[j], wordsArr[k]) && !keywordsSearch(projects[j], wordsArr[k]) && !authorsSearch(projects[j], wordsArr[k])) {
          toAppend = false;
          break;
        }
      }
      if (toAppend) {
        resData.push(projects[j]);
      }
    }
    return resData;
  }
  return projects;
}

function applyFilters(reqQuery, projects) {
  const resData = [];
  const projectLen = projects.length;
  if (reqQuery.filter) {
    const filtersLen = Number(reqQuery.filtersLen);
    if (filtersLen === 1) {
      const filter = reqQuery.filter.toLowerCase();
      for (let i = 0; i < projectLen; i++) {
        if (projects[i].keywords.toString().toLowerCase().indexOf(filter) !== -1) {
          resData.push(projects[i]);
        }
      }
    }
    else { //list of filters in reqQuery.filter[]
      for (let j = 0; j < projectLen; j++) {
        let toAdd = true;
        for (let k = 0; k < filtersLen; k++) {
          if (projects[j].keywords.toString().toLowerCase().indexOf(reqQuery.filter[k].toLowerCase()) === -1) {
            toAdd = false;
            break;
          }
        }
        if (toAdd) {
          resData.push(projects[j]);
        }
      }
    }
    return resData;
  }
  return projects;
}

router.get('/', (req, res) => { //get all projects 
  const search = req.query.search;
  const sortby = req.query.sortby;
  const from = req.query.from;
  let to = req.query.to;
  if (sortby === 'MOST VIEWED') {
    Projects.forge().where({deleted: 'false'}).where({published: 'true'}).orderBy('views', 'DESC').fetchAll()
      .then(resData => {
        const response = resData.toJSON();
        if (response.length < 9) {
          to = response.length;
        }
        const resProjects = applySearch(applyFilters(req.query, response), search).slice(from, to);
        res.status(200).json({error: false, data: getSignedUrl(resProjects)});
      })
      .catch(err => {
        res.status(500).json({error: true, data: {message: err.message}})
      });
  }
  else if (sortby === 'QUALITY OF DOCUMENTATION') {
    Projects.forge().where({deleted: 'false'}).where({published: 'true'}).orderBy('quality_of_documentation', 'DESC').fetchAll()
      .then(resData => {
        const response = resData.toJSON();
        if (response.length < 9) {
          to = response.length;
        }

        const resProjects = applySearch(applyFilters(req.query, response), search).slice(from, to);
        res.status(200).json({error: false, data: getSignedUrl(resProjects)});
      })
      .catch(err => {
        res.status(500).json({error: true, data: {message: err.message}})
      });
  }
  else if (sortby === 'MOST APPRECIATIONS') {
    Projects.forge().where({deleted: 'false'}).where({published: 'true'}).orderBy('likes', 'DESC').fetchAll()
      .then(resData => {
        const response = resData.toJSON();
        if (response.length < 9) {
          to = response.length;
        }
        const resProjects = applySearch(applyFilters(req.query, response), search).slice(from, to);
        res.status(200).json({error: false, data: getSignedUrl(resProjects)});
      })
      .catch(err => {
        res.status(500).json({error: true, data: {message: err.message}})
      });
  }
  else { //return Newest
    Projects.forge().where({deleted: 'false'}).where({published: 'true'}).orderBy('created_at', 'DESC').fetchAll()
      .then(resData => {
        const response = resData.toJSON();
        if (response.length < 9) {
          to = response.length;
        }
        const resProjects = applySearch(applyFilters(req.query, response), search).slice(from, to);
        res.status(200).json({error: false, data: getSignedUrl(resProjects)});
      })
      .catch(err => {
        res.status(500).json({error: true, data: {message: err.message}})
      });
  }
});


router.put('/project/associatedField/', (req, res) => {
  const authorizationHeader = req.headers['authorization'];
  let token;
  if (authorizationHeader) {
    token = authorizationHeader.split(' ')[1]; //authorization header: 'Bearer <token>'
    //split and take the index 1 to access token
  }

  if (token) {
    jwt.verify(token, config.jwtSecret, (err, decode) => {
      if (err) {
        res.status(401).json({error: 'Failed to authenticate'})
      } else {
        if (req.body.published === true || req.body.published === false) {
          Projects.where({id: req.body.id}).where({deleted: false}).where({user_id: decode.id})
            .save({
              associated_project: req.body.associatedProject,
              published: req.body.published
            }, {patch: true})
            .then(() => {
              res.status(200).json({error: false});
            })
            .catch(() => {
              res.status(500).json({error: true})
            });
        }
        else {
          Projects.where({id: req.body.id}).where({deleted: false}).where({user_id: decode.id})
            .save({
              associated_project: req.body.associatedProject
            }, {patch: true})
            .then(() => {
              res.status(200).json({error: false});
            })
            .catch(() => {
              res.status(500).json({error: true})
            });
        }
      }
    });
  }

  else {
    res.status(403).json({error: 'No token provided'});
  }
});

//QUALITY OF DOCUMENTATION ALGORITHM 

//IMAGE FILES AND PROJECT ABSTRACT
function star1(projectData, callback) {
  const heroImage = projectData.heroImageLinkOnS3;
  const coverImage = projectData.headerImageLinkOnS3;
  // const abstract = projectData.projectAbstract;
  const abstractWordCount = count(projectData.projectAbstract);

  if (heroImage && heroImage !== '' && coverImage && coverImage !== '' && abstractWordCount > 50) {
    callback(projectData, 1, star345);
  }
  else {
    callback(projectData, 0, star345);
  }
}

//METADATA
function star2(projectData, stars, callback) {
  const title = projectData.projectTitle;
  const authors = JSON.stringify(projectData.authors.split(','));
  const contactInfo = projectData.contactEmail;
  const usageRights = projectData.usageRights;

  if (title && title !== '' && authors && authors !== '' && contactInfo && contactInfo !== '' && usageRights && usageRights !== '') {
    callback(projectData, stars + 1, setQOD);
  }
  else {
    callback(projectData, stars, setQOD);
  }
}

function setQOD(stars, projectId) {
  Projects.where({id: projectId}).where({deleted: false})
    .save({
      quality_of_documentation: stars
    }, {patch: true})
}

//DESIGN FILES
function star345(projectData, stars) {
  //Check if there exists a file entry with keyword Design: Design file
  //and a file/text entry  with keyword Design: Strand Information
  let designExists = false;
  let strandInfoExists = false;
  let designBlocksCount = 0;
  let introductionBlockExists = false;
  let descriptionBlockExists = false;
  let experimentBlockExists = false;
  Files.where({project_id: projectData.id, deleted: false}).fetchAll()
    .then(_resData => {
      const resData = _resData.toJSON();
      const data = resData.map((file) => {
        const tagsKeywords = JSON.parse(file.tags);

        if (tagsKeywords.Design) {
          if (tagsKeywords.Design.indexOf("Design File") > -1) {
            designExists = true;
          }
          if (tagsKeywords.Design.indexOf("Strand Information") > -1) {
            strandInfoExists = true;
          }
          if (tagsKeywords.Design.length > 0) {
            designBlocksCount++;
          }
          if (!introductionBlockExists && tagsKeywords.Design.indexOf("Introduction") > -1) {
            introductionBlockExists = true;
          }
          if (!descriptionBlockExists && tagsKeywords.Design.indexOf("Description") > -1) {
            descriptionBlockExists = true;
          }
        }
        if (!experimentBlockExists && tagsKeywords.Experiment && tagsKeywords.Experiment.length > 0) {
          experimentBlockExists = true;
        }
        return file;
      });
      if (data) {
        if (designExists && strandInfoExists) {
          stars += 1;
        }
        if (designBlocksCount >= 4 && descriptionBlockExists && introductionBlockExists) {
          stars += 1;
        }
        if (experimentBlockExists) {
          stars += 1;
        }
        setQOD(stars, projectData.id);
      }
    });
}


function qualityOfDoc(projectData) {
  star1(projectData, star2); //pass in a callback function
}

router.put('/project/', (req, res) => {
  const authorizationHeader = req.headers['authorization'];
  let token;
  let _associatedProject = req.body.associatedProject ? req.body.associatedProject : null;

  if (authorizationHeader) {
    token = authorizationHeader.split(' ')[1]; //authorization header: 'Bearer <token>'
    //split and take the index 1 to access token
  }

  if (token) {
    jwt.verify(token, config.jwtSecret, (err, decode) => {
      if (err) {
        res.status(401).json({error: 'Failed to authenticate'})
      } else {
        //RUN QUALITY OF DOCUMENTATION ALGORITHM
        setTimeout(() => {
          qualityOfDoc(req.body);
        }, 1000);
        Projects.where({id: req.body.id}).where({deleted: false}).where({user_id: decode.id})
          .save({
            name: req.body.projectTitle,
            authors: JSON.stringify(req.body.authors.split(',')),
            keywords: JSON.stringify(req.body.keywords.split(',')),
            version: req.body.version,
            header_image_link: req.body.headerImageLinkOnS3,
            hero_image: req.body.heroImageLinkOnS3,
            publication: req.body.publication,
            user_rights: req.body.usageRights,
            contact_email: req.body.contactEmail,
            contact_linkedin: req.body.contactLinkedin,
            contact_facebook: req.body.contactFacebook,
            contact_homepage: req.body.contactHomepage,
            project_abstract: req.body.projectAbstract,
            published: req.body.published,
            associated_project: _associatedProject
          }, {patch: true})
          .then(() => {
            res.status(200).json({error: false});
          })
          .catch(() => {
            res.status(500).json({error: true})
          });
      }
    });
  } else {
    res.status(403).json({error: 'No token provided'});
  }
});

function viewInc(_views, _id) {
  if (_views >= 0) {
    const incBy1 = _views + 1;
    Projects.where({id: _id}).save({views: incBy1}, {patch: true}); //update the project appreciations in database
  }
}

router.put('/project/incViews/', (req, res) => {
  Projects.where({id: req.body.id, deleted: 'false', published: 'true'}).fetch()
    .then(resData => {
      const resProject = resData.toJSON();
      viewInc(resProject.views, resProject.id);
      res.status(200).json({error: false});
    })
    .catch(() => {
      res.status(500).json({error: true})
    });

  //Projects.where({id: _projectId}).save({ deleted: 'true' }, {patch: true}); //update the project appreciations in database
});

router.get('/project/', (req, res) => {
  Projects.where({deleted: 'false'}).where({id: req.query.projectId}).fetch()
    .then(resData => {
      const resProject = resData.toJSON();
      res.status(200).json({error: false, data: singleSignedUrl(resProject)});
    })
    .catch(err => {
      res.status(500).json({error: true, data: {message: err.message}})
    });
});

router.delete('/project/', (req, res) => {
  const _projectId = req.query.project_id;
  const authorizationHeader = req.headers['authorization'];
  let token;

  if (authorizationHeader) {
    token = authorizationHeader.split(' ')[1]; //authorization header: 'Bearer <token>'
    //split and take the index 1 to access token
  }

  if (token) {
    jwt.verify(token, config.jwtSecret, (err, decode) => {
      if (err) {
        res.status(401).json({error: 'Failed to authenticate'})
      } else {
        Projects.where({id: _projectId}).where({user_id: decode.id}).save({deleted: 'true'}, {patch: true}); //update the project appreciations in database
        res.json({success: true, projectId: _projectId});
      }
    });
  }

  else {
    res.status(403).json({error: 'No token provided'});
  }
});

router.post('/project/', (req, res) => {
  const authorizationHeader = req.headers['authorization'];
  let token;

  const _authors = req.body.authors ? JSON.stringify(req.body.authors.split(',')) : JSON.stringify('');
  const _keywords = req.body.keywords ? JSON.stringify(req.body.keywords.split(',')) : JSON.stringify('');
  const _contactEmail = req.body.contactEmail ? req.body.contactEmail : null;
  const _contactLinkedin = req.body.contactLinkedin ? req.body.contactLinkedin : null;
  const _contactFacebook = req.body.contactFacebook ? req.body.contactFacebook : null;
  const _contactHomepage = req.body.contactHomepage ? req.body.contactHomepage : null;
  const _name = req.body.projectTitle ? req.body.projectTitle : null;
  const _version = req.body.version ? req.body.version : null;
  const _headerImageLinkOnS3 = req.body.headerImageLinkOnS3 ? req.body.headerImageLinkOnS3 : null;
  const _heroImageLinkOnS3 = req.body.heroImageLinkOnS3 ? req.body.heroImageLinkOnS3 : null;
  const _publication = req.body.publication ? req.body.publication : null;
  const _userRights = req.body.usageRights ? req.body.usageRights : null;
  const _projectAbstract = req.body.projectAbstract ? req.body.projectAbstract : null;
  let _published = false;
  const _associatedProject = req.body.associatedProject ? req.body.associatedProject : null;

  if (req.body.published === true || req.body.published === false) {
    _published = req.body.published;
  }

  if (authorizationHeader) {
    token = authorizationHeader.split(' ')[1]; //authorization header: 'Bearer <token>'
    //split and take the index 1 to access token
  }

  if (token) {
    jwt.verify(token, config.jwtSecret, (err) => {
      if (err) {
        res.status(401).json({error: 'Failed to authenticate'})
      } else {
        Projects.forge({
          user_id: req.body.user_id,
          name: _name,
          version: _version,
          header_image_link: _headerImageLinkOnS3,
          hero_image: _heroImageLinkOnS3,
          publication: _publication,
          user_rights: _userRights,
          project_abstract: _projectAbstract,
          published: _published,
          views: 0,
          likes: 0,
          contact_linkedin: _contactLinkedin,
          contact_email: _contactEmail,
          contact_facebook: _contactFacebook,
          contact_homepage: _contactHomepage,
          quality_of_documentation: 0,
          keywords: _keywords,
          authors: _authors,
          associated_project: _associatedProject,
          deleted: false
        }, {hasTimestamps: true}).save() //save returns 'promise' so we can use then/catch
          .then(project => {
            res.status(200).json({success: true, project_id: project.toJSON().id});
          })
          .catch(err => {
            res.status(500).json({success: false, data: {message: err.message}})
          })
      }
    });
  }

  else {
    res.status(403).json({error: 'No token provided'});
  }
});

router.get('/comments/', (req, res) => {
  const _projectId = req.query.projectId;
  Comments.query({
    where: {project_id: _projectId}
  }).fetchAll().then(comments => {
    const commentsArr = comments.toJSON();
    res.json({commentsArr});
  });
});

router.post('/comments/', (req, res) => {
  const user_id = req.body.user_id;
  const project_id = req.body.project_id;
  const user_firstname = req.body.user_firstname;
  const user_lastname = req.body.user_lastname;
  const username = req.body.username;
  const comment = req.body.comment;

  Comments.forge({
    user_id,
    project_id,
    username,
    user_firstname,
    user_lastname,
    comment
  }, {hasTimestamps: true}).save()
    .then(() => {
      res.status(200).json({error: false, success: true})
    })
    .catch(err => console.log(err));
});

export default router;
