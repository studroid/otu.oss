'use client';

import Error from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({ error }) {
    useEffect(() => {
        console.error('Global error:', error);
    }, [error]);

    return (
        <html>
            <body>
                <Error />
            </body>
        </html>
    );
}
