export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

// 인메모리 데이터베이스로 게시물 데이터 저장
class PostModel {
  private posts: Map<string, Post> = new Map();

  constructor() {
    // 몇 가지 샘플 게시물 추가
    this.addPost({
      id: '1',
      title: '첫 번째 게시물',
      content: '첫 번째 게시물의 내용입니다.',
      authorId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.addPost({
      id: '2',
      title: '두 번째 게시물',
      content: '두 번째 게시물의 내용입니다.',
      authorId: '2',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.addPost({
      id: '3',
      title: '세 번째 게시물',
      content: '세 번째 게시물의 내용입니다.',
      authorId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 모든 게시물 가져오기
  getAllPosts(): Post[] {
    return Array.from(this.posts.values());
  }

  // ID로 게시물 찾기
  getPostById(id: string): Post | undefined {
    return this.posts.get(id);
  }

  // 게시물 추가
  addPost(post: Post): Post {
    this.posts.set(post.id, post);
    return post;
  }

  // 게시물 수정
  updatePost(id: string, postData: Partial<Post>): Post | undefined {
    const post = this.posts.get(id);
    if (!post) return undefined;

    const updatedPost = {
      ...post,
      ...postData,
      updatedAt: new Date(),
    };

    this.posts.set(id, updatedPost);
    return updatedPost;
  }

  // 게시물 삭제
  deletePost(id: string): boolean {
    return this.posts.delete(id);
  }

  // 작성자 ID로 게시물 검색
  getPostsByAuthor(authorId: string): Post[] {
    return this.getAllPosts().filter((post) => post.authorId === authorId);
  }

  // 제목으로 게시물 검색
  searchPostsByTitle(title: string): Post[] {
    return this.getAllPosts().filter((post) =>
      post.title.toLowerCase().includes(title.toLowerCase())
    );
  }
}

export const postModel = new PostModel();
