export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// 인메모리 데이터베이스로 댓글 데이터 저장
class CommentModel {
  private comments: Map<string, Comment> = new Map();

  constructor() {
    // 몇 가지 샘플 댓글 추가
    this.addComment({
      id: '1',
      postId: '1',
      authorId: '2',
      content: '좋은 게시물이네요!',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.addComment({
      id: '2',
      postId: '1',
      authorId: '1',
      content: '감사합니다!',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.addComment({
      id: '3',
      postId: '2',
      authorId: '1',
      content: '흥미로운 주제입니다.',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 모든 댓글 가져오기
  getAllComments(): Comment[] {
    return Array.from(this.comments.values());
  }

  // ID로 댓글 찾기
  getCommentById(id: string): Comment | undefined {
    return this.comments.get(id);
  }

  // 댓글 추가
  addComment(comment: Comment): Comment {
    this.comments.set(comment.id, comment);
    return comment;
  }

  // 댓글 수정
  updateComment(id: string, commentData: Partial<Comment>): Comment | undefined {
    const comment = this.comments.get(id);
    if (!comment) return undefined;

    const updatedComment = {
      ...comment,
      ...commentData,
      updatedAt: new Date(),
    };

    this.comments.set(id, updatedComment);
    return updatedComment;
  }

  // 댓글 삭제
  deleteComment(id: string): boolean {
    return this.comments.delete(id);
  }

  // 게시물 ID로 댓글 검색
  getCommentsByPost(postId: string): Comment[] {
    return this.getAllComments().filter((comment) => comment.postId === postId);
  }

  // 작성자 ID로 댓글 검색
  getCommentsByAuthor(authorId: string): Comment[] {
    return this.getAllComments().filter((comment) => comment.authorId === authorId);
  }
}

export const commentModel = new CommentModel();
