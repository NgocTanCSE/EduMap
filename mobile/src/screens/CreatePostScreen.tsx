import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'CreatePost'>;

export const CreatePostScreen: React.FC<Props> = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return Alert.alert('Lỗi', 'Tiêu đề và nội dung không được để trống');
    setSubmitting(true);
    try {
      await apiService.createPost({ title, content, tags: tags.split(',').map((s) => s.trim()).filter(Boolean) });
      Alert.alert('Thành công', 'Bài viết đã đăng', [{ text: 'OK', onPress: () => navigation.pop(2) }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Đăng bài thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tạo bài viết</Text>
      <TextInput style={styles.input} placeholder="Tiêu đề" value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} />
      <TextInput
        style={[styles.input, { height: 160, textAlignVertical: 'top' }]}
        placeholder="Nội dung bài viết..."
        value={content}
        onChangeText={setContent}
        multiline
        placeholderTextColor={Colors.textMuted}
      />
      <TextInput style={styles.input} placeholder="Thẻ (phân cách bằng dấu phẩy)" value={tags} onChangeText={setTags} placeholderTextColor={Colors.textMuted} />
      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Đang đăng...' : 'Đăng bài'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
});

export default CreatePostScreen;
