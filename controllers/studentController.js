const Quiz = require("../models/Quiz");
const User = require("../models/User");
const Chapter = require("../models/Chapter");
const Code = require("../models/Code");
const Transaction = require("../models/Transaction");
const mongoose = require('mongoose');

const jwt = require('jsonwebtoken')
const  jwtSecret = process.env.JWTSECRET


const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const stream = require('stream');


const { v4: uuidv4 } = require('uuid')

// ==================  Dash  ====================== //

const dash_get = async (req, res) => {
  try {

    const rankedUsers = await User.find({Grade:req.userData.Grade},{Username:1,userPhoto:1}).sort({ totalScore: -1 }).limit(3);
     
    res.render("student/dash", { title: "DashBoard", path: req.path, userData: req.userData ,rankedUsers :rankedUsers });
  } catch (error) {
    res.send(error.message);
  }
};


// ==================  END Dash  ====================== //


// ==================  Chapter  ====================== //

const chapters_get = async (req, res) => {
  try {
    const buyBy = req.query.buyBy || "Code"
    const chapters = await Chapter.find({ "chapterGrade": req.userData.Grade ,"ARorEN" :req.userData.ARorEN }).sort({ createdAt: 1 });
    const paidChapters = chapters.map(chapter => {
      const isPaid = req.userData.chaptersPaid.includes(chapter._id);
      return { ...chapter.toObject(), isPaid };
    });
    res.render("student/chapters", { title: "Videos", path: req.path, chapters: paidChapters, userData: req.userData ,buyBy });
  } catch (error) {
    res.send(error.message);
  }
  
};


const buyChapter = async (req, res) => {
  try {
    const cahpterId = req.params.cahpterId;
    const code = req.body.code;
    const chapterData = await Chapter.findById(cahpterId,{chapterName:1})
    const CodeData =  await Code.findOneAndUpdate({ "Code": code , "isUsed": false , "codeType":"General"  }, 
   { "isUsed": true, "usedBy": req.userData.Code }, { new: true });
   if (CodeData) {
    await User.findByIdAndUpdate(req.userData._id, { $push: { chaptersPaid: cahpterId } });
    res.redirect('/student/videos/lecture/'+cahpterId);
   }else{
    res.redirect('/student/chapters?error=true');
     }
   
   console.log(CodeData);
  } catch (error) {
    res.send(error.message);
  }
};

const buyChapterByWallet = async (req, res) => { 
  try {
        const transactionId = Math.floor(Math.random() * (500000 - 100000 + 1)) + 100000;

    const cahpterId = req.params.cahpterId;
     await Chapter.findById(cahpterId, {
       chapterName: 1,
       chapterPrice: 1,
     }).then(async (chapterData) => {
        if (req.userData.totalBalance >= chapterData.chapterPrice) {
          await User.findByIdAndUpdate(req.userData._id, {
            $push: { chaptersPaid: cahpterId },
            $inc: { totalBalance: -chapterData.chapterPrice },
          }).then(async(result) => {
            await Transaction.create({ 
              transactionId : transactionId,
              transactionType: "Withdraw",
              transactionPhoto : "Chapter",
              transactionAmount: +chapterData.chapterPrice,
              transactionStatus: "Approved",
              transactionUser: req.userData._id,
              transactionUsedIn: chapterData.chapterName,
              transactionGrade: req.userData.Grade,
              transactionDate: Date.now()
            }).then(() => {
                res.redirect('/student/videos/lecture/' + cahpterId);   
            }).catch((err) => {
              console.log(err);
              res.redirect('/student/chapters?errorBalance=true');
            });
          }).catch((err) => {
            console.log(err);
            res.redirect('/student/chapters?errorBalance=true');
          } );
          
        } else {
          res.redirect('/student/chapters?errorBalance=true');
        }
     });
  
  } catch (error) {
    res.send(error.message);
  }
};



// ================== End Chapter  ====================== //



// ==================  Lecture  ====================== //


const lecture_get = async (req, res) => {
  try {
    const buyBy = req.query.buyBy || "Code"
    const cahpterId = req.params.cahpterId;
    const chapter = await Chapter.findById(cahpterId, { chapterLectures: 1 ,chapterAccessibility:1});
    const isPaid = req.userData.chaptersPaid.includes(cahpterId);
    // console.log(chapter,chapter.chapterAccessibility, isPaid);
    const paidVideos = chapter.chapterLectures.map(lecture => {
      const isPaid = req.userData.videosPaid.includes(lecture._id);
      const vidoeUser = req.userData.videosInfo.find(video => video._id == lecture._id)
      let videoPrerequisitesName
    
      let isUserCanEnter = true
      if(lecture.prerequisites=="WithExamaAndHw" || lecture.prerequisites=="WithExam" || lecture.prerequisites=="WithHw" ){

        const video = req.userData.videosInfo.find(video => video._id == lecture.AccessibleAfterViewing);
        videoPrerequisitesName = video ? video.videoName : null;
        if (lecture.prerequisites=="WithExamaAndHw" ) {
          if (vidoeUser.isUserEnterQuiz && vidoeUser.isUserUploadPerviousHWAndApproved) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
        }else if (lecture.prerequisites=="WithExam") {
          if (vidoeUser.isUserEnterQuiz) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
          
        }else if (lecture.prerequisites=="WithHw") {
          if (vidoeUser.isUserUploadPerviousHWAndApproved) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
          
        }else{
          isUserCanEnter = true
        }

       

      }

      return { ...lecture, isPaid , Attemps : vidoeUser?.videoAllowedAttemps ?? 0 ,videoPrerequisitesName:videoPrerequisitesName || null ,isUserCanEnter:isUserCanEnter};
    });

    console.log(paidVideos);

   if (chapter.chapterAccessibility === "EnterInFree") {
    res.render("student/videos", { title: "Lecture", path: req.path, chapterLectures: paidVideos, userData: req.userData ,chapterId:cahpterId ,buyBy});
    }else{
      if (isPaid) {
        res.render("student/videos", { title: "Lecture", path: req.path, chapterLectures: paidVideos, userData: req.userData,chapterId:cahpterId ,buyBy });
      } else {
        res.redirect('/student/chapters');
      }
    }
    

  } catch (error) {
    res.send(error.message);
  }
}


const sum_get = async (req, res) => {
  try {
    const buyBy = req.query.buyBy || 'Code';
    const cahpterId = req.params.cahpterId;
    const chapter = await Chapter.findById(cahpterId, { chapterSummaries: 1 ,chapterAccessibility:1});
    const isPaid = req.userData.chaptersPaid.includes(cahpterId);
    // console.log(chapter,chapter.chapterAccessibility, isPaid);
    const paidVideos = chapter.chapterSummaries.map(lecture => {
      const isPaid = req.userData.videosPaid.includes(lecture._id);
      const vidoeUser = req.userData.videosInfo.find(video => video._id == lecture._id)
      let videoPrerequisitesName
    
      let isUserCanEnter = true
      if(lecture.prerequisites=="WithExamaAndHw" || lecture.prerequisites=="WithExam" || lecture.prerequisites=="WithHw" ){

        const video = req.userData.videosInfo.find(video => video._id == lecture.AccessibleAfterViewing);
        videoPrerequisitesName = video ? video.videoName : null;
        if (lecture.prerequisites=="WithExamaAndHw" ) {
          if (vidoeUser.isUserEnterQuiz && vidoeUser.isUserUploadPerviousHWAndApproved) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
        }else if (lecture.prerequisites=="WithExam") {
          if (vidoeUser.isUserEnterQuiz) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
          
        }else if (lecture.prerequisites=="WithHw") {
          if (vidoeUser.isUserUploadPerviousHWAndApproved) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
          
        }else{
          isUserCanEnter = true
        }

       

      }

      return { ...lecture, isPaid , Attemps : vidoeUser?.videoAllowedAttemps ?? 0 ,videoPrerequisitesName:videoPrerequisitesName || null ,isUserCanEnter:isUserCanEnter};
    });

    console.log(paidVideos);

   if (chapter.chapterAccessibility === "EnterInFree") {
    res.render("student/videos", { title: "Lecture", path: req.path, chapterLectures: paidVideos, userData: req.userData ,chapterId:cahpterId ,buyBy});
    }else{
      if (isPaid) {
        res.render("student/videos", { title: "Lecture", path: req.path, chapterLectures: paidVideos, userData: req.userData ,chapterId:cahpterId ,buyBy});
      } else {
        res.redirect('/student/chapters');
      }
    }
    

  } catch (error) {
    res.send(error.message);
  }
}

const solv_get = async (req, res) => {
  try {
    const buyBy = req.query.buyBy || 'Code';
    const cahpterId = req.params.cahpterId;
    const chapter = await Chapter.findById(cahpterId, { chapterSolvings: 1 ,chapterAccessibility:1});
    const isPaid = req.userData.chaptersPaid.includes(cahpterId);
    // console.log(chapter,chapter.chapterAccessibility, isPaid);
    const paidVideos = chapter.chapterSolvings.map(lecture => {
      const isPaid = req.userData.videosPaid.includes(lecture._id);
      const vidoeUser = req.userData.videosInfo.find(video => video._id == lecture._id)
      let videoPrerequisitesName
    
      let isUserCanEnter = true
      if(lecture.prerequisites=="WithExamaAndHw" || lecture.prerequisites=="WithExam" || lecture.prerequisites=="WithHw" ){

        const video = req.userData.videosInfo.find(video => video._id == lecture.AccessibleAfterViewing);
        videoPrerequisitesName = video ? video.videoName : null;
        if (lecture.prerequisites=="WithExamaAndHw" ) {
          if (vidoeUser.isUserEnterQuiz && vidoeUser.isUserUploadPerviousHWAndApproved) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
        }else if (lecture.prerequisites=="WithExam") {
          if (vidoeUser.isUserEnterQuiz) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
          
        }else if (lecture.prerequisites=="WithHw") {
          if (vidoeUser.isUserUploadPerviousHWAndApproved) {
            isUserCanEnter = true
          }else{
            isUserCanEnter = false
          }
          
        }else{
          isUserCanEnter = true
        }

       

      }

      return { ...lecture, isPaid , Attemps : vidoeUser?.videoAllowedAttemps ?? 0 ,videoPrerequisitesName:videoPrerequisitesName || null ,isUserCanEnter:isUserCanEnter};
    });

    console.log(paidVideos);

   if (chapter.chapterAccessibility === "EnterInFree") {
    res.render("student/videos", { title: "Lecture", path: req.path, chapterLectures: paidVideos, userData: req.userData ,chapterId:cahpterId ,buyBy});
    }else{
      if (isPaid) {
        res.render("student/videos", { title: "Lecture", path: req.path, chapterLectures: paidVideos, userData: req.userData,chapterId:cahpterId ,buyBy });
      } else {
        res.redirect('/student/chapters');
      }
    }
    

  } catch (error) {
    res.send(error.message);
  }
}

const buyVideo = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const code = req.body.code;


    // Update Code document
    const CodeData = await Code.findOneAndUpdate(
      { Code: code, isUsed: false },
      { isUsed: true, usedBy: req.userData.Code },
      { new: true }
    );

    if (CodeData) {
      // Check if the videoId exists in videosInfo array before updating
      const user = await User.findOne({
        _id: req.userData._id,
        'videosInfo._id': videoId,
      });
      if (user) {
        // Update User document
        await User.findOneAndUpdate(
          { _id: req.userData._id, 'videosInfo._id': videoId },
          {
            $push: { videosPaid: videoId },
            $inc: { totalSubscribed: 1 },
            $set: { 'videosInfo.$.videoPurchaseStatus': true },
          }
        );
        res.status(204).send();
      } else {
        res.status(301).send();
      }
    } else {
      res.status(301).send();
    }
  } catch (error) {
    res.send(error.message);
  }
}

const buyVideoByWallet = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const userId = req.userData._id;
    const transactionId =
      Math.floor(Math.random() * (500000 - 100000 + 1)) + 100000;

    // Get the video price
    const video = await Chapter.findOne(
      { 'chapterLectures._id': videoId },
      { 'chapterLectures.$': 1 }
    );

    const videoPrice = video.chapterLectures[0].videoPrice;
    // Check if the user has enough balance
    if (req.userData.totalBalance >= videoPrice) {
      // Update the user's total balance and add the video to the videosPaid array
      await User.updateOne(
        { _id: userId, 'videosInfo._id': videoId }, // Find the user by ID and locate the specific video by its _id
        {
          $set: { 'videosInfo.$.videoPurchaseStatus': true }, // Update the videoPurchaseStatus to true
          $push: { videosPaid: videoId }, // Add the videoId to videosPaid array
          $inc: { totalSubscribed: 1, totalBalance: -videoPrice }, // Increment and decrement the appropriate fields
        }
      ).then(async (result) => {
        // Create a transaction record
        await Transaction.create({
          transactionId: transactionId,
          transactionType: 'Withdraw',
          transactionPhoto: 'Video',
          transactionAmount: +videoPrice,
          transactionStatus: 'Approved',
          transactionUser: userId,
          transactionUsedIn: video.chapterLectures[0].videoTitle,
          transactionGrade: req.userData.Grade,
          transactionDate: Date.now(),
        })
          .then(() => {
            res.redirect(
              'back'
            );
          })
          .catch((err) => {
            console.log(err);
            res.redirect(
              '/student/videos/lecture/' + video._id + '?errorBalance=true'
            );
          });
      });
    } else {
      res.redirect(
        '/student/videos/lecture/' + video._id + '?errorBalance=true'
      );
    }
  } catch (error) {
    res.send(error.message);
  }
};

// ================== End Lecture  ====================== //




// ==================  Watch  ====================== //
async function updateWatchInUser(req, res, videoId, chapterID) {
  const videoInfo = req.userData.videosInfo.find(
    (video) => video._id.toString() === videoId.toString()
  );
  console.log(videoInfo);
  const c = 1;

  if (videoInfo.videoAllowedAttemps <= 0) {
    return res.redirect('/student/videos/lecture/' + chapterID);
  }
  if (!videoInfo.fristWatch) {
    await User.findOneAndUpdate(
      { _id: req.userData._id, 'videosInfo._id': videoId },
      {
        $set: {
          'videosInfo.$.fristWatch': Date.now(),
          'videosInfo.$.lastWatch': Date.now(),
        },
        $inc: {
          // Decrementing the values of videoAllowedAttemps and numberOfWatches
          'videosInfo.$.videoAllowedAttemps': -c,
          'videosInfo.$.numberOfWatches': +c,
        },
      }
    );
  } else {
    await User.findOneAndUpdate(
      { _id: req.userData._id, 'videosInfo._id': videoId },
      {
        $set: {
          'videosInfo.$.lastWatch': Date.now(),
        },
        $inc: {
          // Decrementing the values of videoAllowedAttemps and numberOfWatches
          'videosInfo.$.videoAllowedAttemps': -c,
          'videosInfo.$.numberOfWatches': +c,
        },
      }
    );
  }
}
async function getVideoWatch(req, res) {
  const { videoType, chapterID, VideoId } = req.params;
  const chapter = await Chapter.findById(chapterID, {
    chapterLectures: 1,
    chapterSummaries: 1,
    chapterSolvings: 1,
  });

  const videoCollections = {
    lecture: chapter.chapterLectures,
    summaries: chapter.chapterSummaries,
    Solving: chapter.chapterSolvings,
  };

  const video = videoCollections[videoType]?.find((vid) => vid._id == VideoId);
  if (!video) {
    return res.redirect('/error'); // Redirect if video not found
  }

  const isPaid = req.userData.videosPaid.includes(VideoId);
  const requiresPayment = video.paymentStatus === 'Pay';

  if (requiresPayment && !isPaid) {
    return res.redirect(`/student/videos/${videoType}/${chapterID}`);
  }

  // Update user watch history and render video with tokenized link
  await updateWatchInUser(req, res, VideoId, chapterID);

  // Define video path and other parameters for Bunny.net token
  const videoId = video.videoURL; // Example video ID as token ID
  // const tokenSecurityKey = '3c13c271-d42b-4ca6-8967-45c515bd0f67'; // Replace with actual Bunny.net secret key
  // const expirationInSeconds = 50;
  // const expirationTimestamp =
  //   Math.floor(Date.now() / 1000) + expirationInSeconds;

  // const token = generateBunnyToken(
  //   tokenSecurityKey,
  //   videoId,
  //   expirationTimestamp
  // );

  // Construct the tokenized URL
  let tokenizedURL = `https://iframe.mediadelivery.net/embed/337128/${videoId}`;
  if (
    video.videoURL.startsWith('<iframe') ||
    video.videoURL.startsWith('<div')
  ) {
    tokenizedURL = video.videoURL;
  }
  res.render('student/watch', {
    title: 'Watch',
    path: req.path,
    video: {
      ...video,
      videoURL: tokenizedURL,
    },
    userData: req.userData,
  });
}



const watch_get = async (req, res) => {
  try {
    
  await getVideoWatch(req,res)
  } catch (error) {
    res.send(error.message);
  }

};

const uploadHW = async (req, res) => {
  try {
    const VideoId = req.params.VideoId;
    const userId = req.userData._id;
    const HomeWorkPhotos = req.body.HomeWorkPhotos;

    // Update the specific video's isHWIsUploaded field
    await User.findOneAndUpdate(
      { _id: userId, 'videosInfo._id': VideoId },
      {
        $set: {
          'videosInfo.$.isHWIsUploaded': true,
          'videosInfo.$.HomeWorkPhotos': HomeWorkPhotos,
        },
      }
    );

    // Optionally, you can call getVideoWatch after updating the field
    await getVideoWatch(req, res);
  } catch (error) {
    res.status(500).send(error.message);
  }
};





// ================== END Watch  ====================== //





// ================== Ranking  ====================== //

const ranking_get = async (req,res)=>{
  try {

    const { searchInput } = req.query;
    let perPage =20;
    let page = req.query.page || 1;
    
    if (searchInput) {
      // Find the student with the given Code
      const student = await User.findOne({ Code: searchInput }).exec();
    
      // Find all students and sort them by totalScore
      const allStudents = await User.find({}, { Username: 1, Code: 1, totalScore: 1 })
        .sort({ totalScore: -1 })
    

      // Find the index of the student in the sorted array
      const userRank = allStudents.findIndex(s => s.Code === +searchInput) + 1;
      console.log(userRank);
      const paginatedStudents = await User.find({ Code: searchInput }, { Username: 1, Code: 1, totalScore: 1 })
        .sort({ totalScore: -1 })
    
    
      const count = await User.countDocuments({});
    
      const nextPage = parseInt(page) + 1;
      const hasNextPage = nextPage <= Math.ceil(count / perPage);
      const hasPreviousPage = page > 1;
    
      res.render("student/ranking", {
        title: "Ranking",
        path: req.path,
        isSearching: true,
        userData: req.userData,
        rankedUsers: paginatedStudents,
        nextPage: hasNextPage ? nextPage : null,
        previousPage: hasPreviousPage ? page - 1 : null,
        userRank: userRank // Include user's rank in the response
      });
    
      return;
    }
    
    else{
      await User.find({ Grade: req.userData.Grade }, { Username: 1, Code: 1, totalScore: 1 })
        .sort({ totalScore: -1 })
        .then(async (result) => {
          const count = await Code.countDocuments({});
          const nextPage = parseInt(page) + 1;
          const hasNextPage = nextPage <= Math.ceil(count / perPage);
          const hasPreviousPage = page > 1;
      
          res.render("student/ranking", {
            title: "Ranking",
            path: req.path,
            userData: req.userData,
            rankedUsers: result,
            nextPage: hasNextPage ? nextPage : null,
            previousPage: hasPreviousPage ? page - 1 : null,
            userRank: null,
            isSearching: false
          });
      
          }).catch((err)=>{
            console.log(err)
          })
          return
        }
  } catch (error) {
    console.log()
  }
  
}

// ================== END Ranking  ====================== //




// ================== Exams  ====================== //
const exams_get = async (req, res) => {
  
  try {
    // Get the top 3 ranked users by total score
    const rankedUsers = await User.find({ Grade: req.userData.Grade }, { Username: 1, userPhoto: 1 })
      .sort({ totalScore: -1 })
      .limit(3);

    // Get all exams for the user's grade
    const exams = await Quiz.find({ Grade: req.userData.Grade }).sort({ createdAt: 1 });

    // Map through the exams and add additional information
    const paidExams = await Promise.all(exams.map(async (exam) => {
      const isPaid = req.userData.examsPaid.includes(exam._id);
      const quizUser = req.userData.quizesInfo.find(quiz => quiz._id.toString() === exam._id.toString());

    // Get all user scores for the current quiz
      const users = await User.find({ Grade: req.userData.Grade, 'quizesInfo._id': exam._id })
      .select('quizesInfo.$');

    // Extract and sort the scores
      const userScores = users
        .map(user => ({
          userId: user._id,
          score: user.quizesInfo[0].Score
        }))
        .sort((a, b) => b.score - a.score);


      // Find the rank of the current user
      const userRank = userScores.findIndex(result => result.userId.toString() === req.userData._id.toString()) + 1;

      const quizInfo = quizUser ? {
        isEnterd: quizUser.isEnterd,
        inProgress: quizUser.inProgress,
        Score: quizUser.Score,
        answers: quizUser.answers,
        rank: userRank,  // Add user rank here
        lengthOfUsersTakesQuiz  : userScores.length,  // Add total number of users who took the quiz
        // Add other properties you want to include
      } : null;

      return { ...exam.toObject(), isPaid, quizUser: quizInfo };
    }));

    res.render("student/exams", { title: "Exams", path: req.path, userData: req.userData, rankedUsers, exams: paidExams });
  } catch (error) {
    res.send(error.message);
  }
};





const buyQuiz = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const code = req.body.code;
    const quizObectId = new mongoose.Types.ObjectId(quizId);
    console.log(quizId, quizObectId);
   const CodeData =  await Code.findOneAndUpdate ({"Code": code,"codeType":"Quiz" ,"isUsed": false , "codeFor": quizId   }, 
   { "isUsed": true, "usedBy": req.userData.Code  }, { new: true }); 
    if (CodeData) { 
      console.log(req.userData._id);
      
      await User.findOneAndUpdate({_id: req.userData._id ,  'quizesInfo._id': quizObectId  }, { $push: { examsPaid: quizId } ,$set: { 'quizesInfo.$.quizPurchaseStatus': true } } ); 
  
      res.redirect('/student/exams');
    }
    else{
      res.redirect('/student/exams?error=true');
    }
  }
  catch (error ) {
    res.redirect('/student/exams?error=true');
  } 
}
// ================== END Exams  ====================== //



// ================== quiz  ====================== //
const quiz_get = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    const quizUser = req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );

    console.log(quiz, quizUser);
    if (!quiz) {
      return res.redirect('/student/exams');
    }

    if (
      !quizUser ||
      !quiz.permissionToShow ||
      (quizUser.isEnterd && !quizUser.inProgress)
    ) {
      return res.redirect('/student/exams');
    }

    const isPaid = req.userData.examsPaid.includes(quizId);
    if (quiz.prepaidStatus && !isPaid) {
      return res.redirect('/student/exams');
    }

    res.render('student/quiz', {
      title: 'Quiz',
      path: req.path,
      quiz: quiz,
      userData: req.userData,
      question: null,
    });
  } catch (error) {
    res.send(error.message);
  }
};

const quizWillStart = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    const quizUser = req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );

    const durationInMinutes = quiz.timeOfQuiz;

    const endTime = new Date(Date.now() + durationInMinutes * 60000);
    console.log(endTime, durationInMinutes);
    if (!quizUser.endTime) {
      console.log(quizUser.endTime);
      await User.findOneAndUpdate(
        { _id: req.userData._id, 'quizesInfo._id': quiz._id },
        {
          $set: {
            'quizesInfo.$.endTime': endTime,
            'quizesInfo.$.inProgress': true,
          },
        }
      ).then((result) => {
        console.log(result);
        res.redirect(`/student/quizStart/${quizId}?qNumber=1`);
      });
    } else {
      res.redirect(`/student/quizStart/${quizId}?qNumber=1`);
    }
  } catch (error) {
    res.send(error.message);
  }
};

const escapeSpecialCharacters = (text) => {
  try {
    // Attempt to parse the JSON string
    const parsedText = JSON.parse(text);
    // If parsing succeeds, stringify it back and escape special characters
    const escapedText = JSON.stringify(parsedText, (key, value) => {
      if (typeof value === 'string') {
        return value.replace(/["\\]/g, '\\$&');
      }
      return value;
    });
    return escapedText;
  } catch (error) {
    // If parsing fails, return the original text
    return text;
  }
};

const quiz_start = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    const userQuizInfo = req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );

    // Redirect if quiz or user info not found
    if (
      !quiz ||
      !userQuizInfo ||
      !quiz.permissionToShow ||
      (userQuizInfo.isEnterd && !userQuizInfo.inProgress)
    ) {
      return res.redirect('/student/exams');
    }

    // Redirect if user didn't pay for the quiz
    const isPaid = req.userData.examsPaid.includes(quizId);
    if (quiz.prepaidStatus && !isPaid) {
      return res.redirect('/student/exams');
    }

    // Redirect if quiz is not yet started
    if (!userQuizInfo.endTime) {
      return res.redirect('/student/exams');
    }

    // Parse query parameter for question number
    let questionNumber = parseInt(req.query.qNumber) || 1;
    if (questionNumber > quiz.questionsCount) {
      questionNumber = quiz.questionsCount;
      console.log(questionNumber);
    }

    // Find the current question and escape special characters
    const question = quiz.Questions.find(
      (q) => q.qNumber.toString() === questionNumber.toString()
    );

    question.title = escapeSpecialCharacters(question.title);
    question.answer1 = escapeSpecialCharacters(question.answer1);
    question.answer2 = escapeSpecialCharacters(question.answer2);
    question.answer3 = escapeSpecialCharacters(question.answer3);
    question.answer4 = escapeSpecialCharacters(question.answer4);

    res.render('student/quizStart', {
      title: 'Quiz',
      path: req.path,
      quiz,
      userData: req.userData,
      question,
      userQuizInfo,
    });
  } catch (error) {
    res.send(error.message);
  }
};

const quizFinish = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quizObjId = new mongoose.Types.ObjectId(quizId);

    const quiz = await Quiz.findById(quizId);
    const userQuizInfo = req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );
    const quizData = req.body;
    let answers = quizData.answers;
    const score = quizData.score;

    // Calculate the percentage score
    const scorePercentage = (score / quiz.questionsCount) * 100;

    // If user has already entered and quiz is not in progress, redirect
    if (userQuizInfo.isEnterd && !userQuizInfo.inProgress) {
      return res.redirect('/student/exams');
    }

  

    // Update user's quiz info if score is 60% or above
    User.findOneAndUpdate(
      { _id: req.userData._id, 'quizesInfo._id': quizObjId },
      {
        $set: {
          'quizesInfo.$.answers': answers,
          'quizesInfo.$.Score': +score,
          'quizesInfo.$.inProgress': false,
          'quizesInfo.$.isEnterd': true,
          'quizesInfo.$.solvedAt': Date.now(),
          'quizesInfo.$.endTime': null,
        },
        $inc: { totalScore: +score, totalQuestions: +quiz.questionsCount },
      }
    ).then(async (result) => {
      // Check if there's a corresponding video for the quiz in user's videosInfo
      const videoInfo = req.userData.videosInfo.find(
        (video) => video._id === quiz.videoWillbeOpen
      );
      if (videoInfo && !videoInfo.isUserEnterQuiz) {
        // Update the video's entry to mark it as entered by the user
        await User.findOneAndUpdate(
          { _id: req.userData._id, 'videosInfo._id': videoInfo._id },
          { $set: { 'videosInfo.$.isUserEnterQuiz': true } }
        ).then((result) => {
          res.redirect('/student/exams');
        });
      } else {
        res.redirect('/student/exams');
      }
    });
  } catch (error) {
    res.send(error.message);
  }
};

const review_Answers = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quizObjId = new mongoose.Types.ObjectId(quizId);
    const quiz = await Quiz.findById(quizId);
    const userQuizInfo = req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );
    const quizData = req.body;

    // Redirect if quiz or user info not found
    if (!quiz.permissionToShow) {
      return res.redirect('/student/exams');
    }

    // Parse query parameter for question number
    let questionNumber = parseInt(req.query.qNumber) || 1;
    if (questionNumber > quiz.questionsCount) {
      questionNumber = quiz.questionsCount;
      console.log(questionNumber);
    }

    // Find the current question and escape special characters
    const question = quiz.Questions.find(
      (q) => q.qNumber.toString() === questionNumber.toString()
    );

    question.title = escapeSpecialCharacters(question.title);
    question.answer1 = escapeSpecialCharacters(question.answer1);
    question.answer2 = escapeSpecialCharacters(question.answer2);
    question.answer3 = escapeSpecialCharacters(question.answer3);
    question.answer4 = escapeSpecialCharacters(question.answer4);

    res.render('student/reviewAnswers', {
      title: 'Quiz',
      path: req.path,
      quiz,
      userData: req.userData,
      question,
      userQuizInfo,
    });
  } catch (error) {
    res.send(error.message);
  }
};



// ================== END quiz  ====================== //



// ================== Wallet  ====================== //

const wallet_get = async (req, res) => { 
  try {
    res.render("student/wallet", { title: "Wallet", path: req.path, userData: req.userData });
    console.log(req.userData  );
  } catch (error) {
    res.send(error.message);
  }
}

const wallet_post = async (req, res) => {
  try {

 

    const transactionId = Math.floor(Math.random() * (500000 - 100000 + 1)) + 100000;
    const { amount, provePhoto } = req.body;
    const transaction = Transaction.create({
      transactionId: transactionId,
      transactionAmount: +amount,
      transactionType: 'Deposit',
      transactionStatus: 'Pending',
      transactionGrade: req.userData.Grade,
      transactionUser: req.userData._id,
      transactionPhoto: provePhoto,
      transactionUsedIn : "",
      transactionDate: Date.now(),
    })
      .then(async () => {
      const user = await User.findByIdAndUpdate(
        req.userData._id,
        {
          $inc: { pendingBalance: +amount},
          $push: {
            transactions: {
              transactionId: transactionId,
              transactionAmount: +amount,
              transactionType: 'Deposit',
              transactionStatus: 'Pending',
              transactionPhoto: provePhoto,
              transactionDate: Date.now(),
            },
          },
        },
        { new: true, runValidators: true }
      )
        .then((result) => {
          console.log(result);
          res.redirect('/student/wallet');
        })
        .catch((err) => {
          console.log(err);
          res.redirect('/student/wallet?error=true');
        });
      })
      .catch((err) => {
               console.log(err);
        res.redirect('/student/wallet?error=true');
      });


  
  }
  catch (error ) {
   res.redirect('/student/wallet?error=true');
  }
}

// ================== END Wallet  ====================== //


// ================== Settings  ====================== //

const settings_get = async (req, res) => {
  try {
    res.render("student/settings", { title: "Settings", path: req.path, userData: req.userData });
  } catch (error) {
    res.send(error.message);
  }
}

const settings_post = async (req, res) => {
  try {
    const { Username, gov,userPhoto } = req.body;
    console.log(Username, gov);
    const user = await User.findByIdAndUpdate(req.userData._id, { Username:Username, gov :gov ,userPhoto:userPhoto});

    res.redirect('/student/settings');
  }
  catch (error  ) {
    res.send(error.message);
  }
}



// ================== LogOut  ====================== //



const logOut = async (req, res) => {
  // Clearing the token cookie
  res.clearCookie('token');
  // Redirecting to the login page or any other desired page
  res.redirect('../login');
}


// ================== END LogOut  ====================== //



module.exports = {
  dash_get,


  chapters_get,
  buyChapter,
  buyChapterByWallet,
  lecture_get,
  sum_get,
  solv_get,
  buyVideo,
  buyVideoByWallet,
  
  watch_get,
  uploadHW,

  ranking_get,

  exams_get,
  buyQuiz,

  quiz_get,
  quizWillStart,
  quiz_start,
  quizFinish,
  review_Answers,

  wallet_get,

  wallet_post,

  settings_get,
  settings_post,


  logOut,
};
