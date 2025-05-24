// Import các thư viện cần thiết
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const axios = require('axios');
const express = require('express'); // <-- Sử dụng Express cho Web Service
const app = express();

// Middleware để parse body của request dưới dạng JSON
app.use(express.json());

// Lấy YouTube API Key từ biến môi trường
// Đây là phương pháp khuyến nghị để bảo mật API Key của bạn
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// --- Dòng này chỉ để kiểm tra trong log, bạn có thể xóa nó sau khi kiểm tra thành công ---
console.log("Using YouTube API Key (first 5 chars):", YOUTUBE_API_KEY ? YOUTUBE_API_KEY.substring(0, 5) : "Not set or undefined");
// --- Kết thúc dòng kiểm tra ---


// Định nghĩa endpoint cho Webhook
// Dialogflow sẽ gửi yêu cầu POST đến /webhook
app.post('/webhook', (request, response) => {
    // Tạo một đối tượng WebhookClient để dễ dàng làm việc với Dialogflow
    const agent = new WebhookClient({ request, response });

    // (Tùy chọn) Ghi log request từ Dialogflow để dễ gỡ lỗi
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    // Hàm xử lý Intent 'SuggestSong', 'AskByGenre', 'AskByMood', 'AskByArtist'
    async function handleSuggestSong(agent) {
        const genre = agent.parameters.genre;
        const mood = agent.parameters.mood;
        const artist = agent.parameters.artist;

        let searchQuery = "";
        let botInitialResponse = "";

        // Xây dựng truy vấn tìm kiếm dựa trên tham số nhận được
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
            // Nếu không có tham số nào, yêu cầu người dùng cung cấp thêm thông tin
            agent.add("Bạn muốn nghe nhạc theo thể loại, tâm trạng, hay của ca sĩ nào?");
            return; // Dừng hàm tại đây
        }

        try {
            // Xây dựng URL cho YouTube Data API v3 Search
            const youtubeSearchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)} official music video&type=video&key=${YOUTUBE_API_KEY}`;
            console.log("Calling YouTube API with URL:", youtubeSearchUrl); // Log URL gọi API

            // Gửi yêu cầu GET đến YouTube Data API
            const youtubeApiResponse = await axios.get(youtubeSearchUrl);

            // Kiểm tra phản hồi từ YouTube API
            if (youtubeApiResponse.data && youtubeApiResponse.data.items && youtubeApiResponse.data.items.length > 0) {
                const firstVideo = youtubeApiResponse.data.items[0];
                const videoTitle = firstVideo.snippet.title;
                const videoId = firstVideo.id.videoId;
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`; // URL đầy đủ đến video YouTube

                // Thêm phản hồi văn bản và rich response cho Dialogflow
                agent.add(`<span class="math-inline">\{botInitialResponse\} "</span>{videoTitle}". Link video: ${videoUrl}`);
// Giữ nguyên khối agent.add(new Payload(agent.ACTIONS_ON_GOOGLE, {...})); bên dưới

                // Thêm Rich Response (Basic Card) cho các nền tảng hỗ trợ (ví dụ: Google Assistant)
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
                            ],
                            // (Tùy chọn) Thêm hình ảnh thumbnail
                            "image": {
                              "url": firstVideo.snippet.thumbnails.high.url,
                              "accessibilityText": videoTitle
                            }
                          }
                        }
                      ]
                    }
                }));

            } else {
                // Nếu không tìm thấy video nào
                agent.add(`Xin lỗi, tôi không tìm thấy bài hát nào phù hợp với yêu cầu "${searchQuery}" của bạn trên YouTube.`);
            }
        } catch (error) {
            // Xử lý lỗi khi gọi API YouTube
            console.error("Lỗi khi gọi API YouTube:", error.message);
            // Log thêm thông tin chi tiết lỗi từ Axios nếu có
            if (error.response) {
                console.error("YouTube API Response Data:", error.response.data);
                console.error("YouTube API Response Status:", error.response.status);
            }
            // Phản hồi cho người dùng rằng có lỗi xảy ra
            agent.add("Xin lỗi, tôi đang gặp sự cố khi tìm kiếm bài hát. Vui lòng thử lại sau.");
        }
    }

    // Tạo một Map để ánh xạ Intent với các hàm xử lý
    let intentMap = new Map();
    intentMap.set('SuggestSong', handleSuggestSong);
    intentMap.set('AskByGenre', handleSuggestSong);
    intentMap.set('AskByMood', handleSuggestSong);
    intentMap.set('AskByArtist', handleSuggestSong); // Các Intent này đều gọi cùng một hàm xử lý

    // Xử lý request từ Dialogflow dựa trên Intent được nhận diện
    agent.handleRequest(intentMap);
});

// Khởi động máy chủ Express để lắng nghe các yêu cầu
// Render.com sẽ cung cấp cổng qua biến môi trường PORT
const PORT = process.env.PORT || 3000; // Sử dụng cổng do Render cung cấp hoặc 3000 nếu chạy cục bộ
app.listen(PORT, () => {
    console.log(`Webhook server listening on port ${PORT}`);
});