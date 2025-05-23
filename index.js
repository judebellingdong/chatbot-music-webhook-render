// index.js (Phiên bản phù hợp với Render - sử dụng Express)

const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const axios = require('axios');
const express = require('express'); // <-- Quan trọng: sử dụng express
const app = express();
app.use(express.json());

// <<< THAY THẾ BẰNG YOUTUBE API KEY CỦA BẠN >>>
const YOUTUBE_API_KEY = "AIzaSyCSFdmYx5WsyMB9vr2N6121WXwZlUKZHyw"; 

// Endpoint cho Webhook
app.post('/webhook', (request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    async function handleSuggestSong(agent) {
        const genre = agent.parameters.genre;
        const mood = agent.parameters.mood;
        const artist = agent.parameters.artist;

        let searchQuery = "";
        let botInitialResponse = "";

        if (genre) {
            searchQuery = `nhạc ${genre}`;
            botInitialResponse = `Để tôi tìm nhạc ${genre} cho bạn:`;
        } else if (mood) {
            searchQuery = `bài hát ${mood}`;
            botInitialResponse = `Tìm kiếm bài hát cho tâm trạng ${mood} của bạn:`;
        } else if (artist) {
            searchQuery = `bài hát của ${artist}`;
            botInitialResponse = `Tìm kiếm nhạc của ${artist} cho bạn:`;
        } else {
            agent.add("Bạn muốn nghe nhạc theo thể loại, tâm trạng, hay của ca sĩ nào?");
            return;
        }

        try {
            const youtubeSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=<span class="math-inline">\{encodeURIComponent\(searchQuery\)\} official music video&type\=video&key\=</span>{YOUTUBE_API_KEY}`;
            const youtubeApiResponse = await axios.get(youtubeSearchUrl);

            if (youtubeApiResponse.data && youtubeApiResponse.data.items && youtubeApiResponse.data.items.length > 0) {
                const firstVideo = youtubeApiResponse.data.items[0];
                const videoTitle = firstVideo.snippet.title;
                const videoId = firstVideo.id.videoId;
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

                agent.add(`<span class="math-inline">\{botInitialResponse\} "</span>{videoTitle}"`);
                agent.add(videoUrl);
                agent.add(new Payload(agent.ACTIONS_ON_GOOGLE, {
                    "expectUserResponse": true,
                    "richResponse": {
                      "items": [
                        {
                          "simpleResponse": {
                            "textToSpeech": `${botInitialResponse} ${videoTitle}`
                          }
                        },
                        {
                          "basicCard": {
                            "title": videoTitle,
                            "formattedText": `Link xem video: ${videoUrl}`,
                            "buttons": [
                              {
                                "title": "Xem trên YouTube",
                                "openUriAction": {
                                  "uri": videoUrl
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                }));
            } else {
                agent.add(`Xin lỗi, tôi không tìm thấy bài hát nào phù hợp với yêu cầu "${searchQuery}" của bạn trên YouTube.`);
            }
        } catch (error) {
            console.error("Lỗi khi gọi API YouTube:", error.message);
            agent.add("Xin lỗi, tôi đang gặp sự cố khi tìm kiếm bài hát. Vui lòng thử lại sau.");
        }
    }

    let intentMap = new Map();
    intentMap.set('SuggestSong', handleSuggestSong);
    intentMap.set('AskByGenre', handleSuggestSong);
    intentMap.set('AskByMood', handleSuggestSong);
    intentMap.set('AskByArtist', handleSuggestSong);

    agent.handleRequest(intentMap);
});

// Khởi động máy chủ Express
// Render sẽ cung cấp cổng qua biến môi trường PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook server listening on port ${PORT}`);
});