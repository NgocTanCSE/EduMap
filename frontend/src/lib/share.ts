import { toast } from "@/src/lib/toast";
export async function shareLink({ title, text, url, }: {
    title: string;
    text?: string;
    url?: string;
}): Promise<boolean> {
    const shareUrl = url || window.location.href;
    const payload = { title, text: text || title, url: shareUrl };
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            await navigator.share(payload);
            return true;
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Đã sao chép liên kết.');
            return true;
        }
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('Đã sao chép liên kết.');
        return true;
    }
    catch (error) {
        if ((error as DOMException)?.name === 'AbortError')
            return false;
        toast.error('Không thể chia sẻ liên kết.');
        return false;
    }
}
