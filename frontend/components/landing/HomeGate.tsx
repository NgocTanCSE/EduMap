'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import EduMapLanding from './EduMapLanding';
export default function HomeGate() {
    const { user, loading } = useAuth();
    const router = useRouter();
    useEffect(() => {
        if (loading)
            return;
        if (user)
            router.replace('/map');
    }, [user, loading, router]);
    return <EduMapLanding />;
}
