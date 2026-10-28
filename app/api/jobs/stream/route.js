import { getJobsList, subscribeJobEvents } from '@/lib/books';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendMsg = (payload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // stream closed
        }
      };
      sendMsg({ type: 'snapshot', jobs: getJobsList() });
      unsubscribe = subscribeJobEvents((event, payload) => {
        if (event === 'job-log') {
          sendMsg(payload);
        } else if (event === 'job-update') {
          sendMsg({ type: payload.status === 'running' ? 'job-start' : 'job-end', job: payload });
        }
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
