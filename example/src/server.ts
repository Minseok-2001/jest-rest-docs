import express from 'express';
import http from 'http';
import userRoutes from './routes/userRoutes';
import postRoutes from './routes/postRoutes';
import commentRoutes from './routes/commentRoutes';

const app = express();
app.use(express.json());

// 라우트 등록
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

// 에러 핸들링 미들웨어
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
    },
  });
});

// 서버 생성
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// 서버 시작 함수
const startServer = () => {
  server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
  });
};

// 직접 실행되었을 때만 서버 시작
if (require.main === module) {
  startServer();
}

export { app, server };
