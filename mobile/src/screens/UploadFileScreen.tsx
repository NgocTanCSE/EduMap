import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import { apiService } from '../services/api';
import { Upload } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'UploadFile'>;

/**
 * File upload entry point.
 * NOTE: A real device picker (expo-document-picker) is not installed in this env,
 * so we accept a file URL + metadata. Hook up expo-document-picker on device to
 * supply a local `uri` from `DocumentPicker.getDocumentAsync()`.
 */
export const UploadFileScreen: React.FC<Props> = () => {
  const [uri, setUri] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('application/octet-stream');
  const [submitting, setSubmitting] = useState(false);
  const [uploaded, setUploaded] = useState<any>(null);

  const handleUpload = async () => {
    if (!uri || !name) return Alert.alert('Lỗi', 'Nhập URL và tên tệp');
    setSubmitting(true);
    try {
      const res = await apiService.uploadFile({ uri, name, type });
      setUploaded(res?.data || res);
      Alert.alert('Thành công', 'Tải lên thành công');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Tải lên thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
        <Upload size={22} color={Colors.primary} />
        <Text style={styles.title}>Tải lên tệp</Text>
      </View>
      <Field label="URL tệp (hoặc uri thiết bị)" value={uri} onChange={setUri} />
      <Field label="Tên tệp" value={name} onChange={setName} />
      <Field label="MIME type" value={type} onChange={setType} />
      <TouchableOpacity style={styles.btn} onPress={handleUpload} disabled={submitting}>
        {submitting ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>Tải lên</Text>}
      </TouchableOpacity>
      {uploaded?.url ? (
        <TouchableOpacity onPress={() => Linking.openURL(uploaded.url)}>
          <Text style={styles.link}>Mở tệp đã tải lên</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <View style={{ marginBottom: Spacing.sm }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} value={value} onChangeText={onChange} placeholderTextColor={Colors.textMuted} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
  link: { color: Colors.info, marginTop: Spacing.sm, fontSize: FontSize.sm },
});

export default UploadFileScreen;
