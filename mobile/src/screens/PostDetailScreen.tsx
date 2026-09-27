import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'PostDetail'>;

export const PostDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([apiService.getPost(id), apiService.getComments(id)]);
      setPost(p?.data || p);
      setComments((c?.data || c || []).filter(Boolean));
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tải được bài viết');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchPost(); }, [id]);

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await apiService.createComment(id, { content: newComment });
      setNewComment('');
      fetchPost();
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi bình luận thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async () => {
    try { await apiService.likePost(id); fetchPost(); } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{post?.title || 'Bài viết'}</Text>
        <TouchableOpacity onPress={handleLike}><Text style={styles.like}>♥ {post?.likes_count || 0}</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
        <>
          <Text style={styles.body}>{post?.content || ''}</Text>
          <View style={styles.meta}>
            <Text style={styles.author}>{post?.author?.full_name || `Người dùng #${post?.user_id}`}</Text>
          </View>
          <Text style={styles.sectionTitle}>Bình luận</Text>
          <FlatList
            data={comments}
            keyExtractor={(item, i) => item.id || `${i}`}
            ListEmptyComponent={<Text style={styles.empty}>Chưa có bình luận</Text>}
            renderItem={({ item }) => (
              <View style={styles.comment}>
                <Text style={styles.commentBody}>{item.content}</Text>
                <Text style={styles.commentMeta}>{item.user?.full_name || item.user_id || 'Ẩn danh'}</Text>
              </View>
            )}
          />
          <View style={styles.row}>
            <TextInput style={styles.input} placeholder="Viết bình luận..." value={newComment} onChangeText={setNewComment} onSubmitEditing={handleComment} placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.sendBtn} onPress={handleComment} disabled={submitting}><Text style={styles.sendText}>Gửi</Text></TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', flex: 1 },
  like: { color: Colors.danger, fontSize: FontSize.sm },
  body: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginBottom: 8 },
  meta: { marginBottom: Spacing.md },
  author: { color: Colors.textMuted, fontSize: FontSize.xs },
  sectionTitle: { color: Colors.text, fontWeight: '700', marginBottom: 8 },
  comment: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  commentBody: { color: Colors.text, fontSize: FontSize.sm },
  commentMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 20 },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  input: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: Colors.background, fontWeight: '600' },
});

export default PostDetailScreen;
