import type { Performance, Story } from './protocol';

export const mockLines = {
  greeting: '你好，我叫米拉。雨刚停，外面的路还很湿。你也在等雨过去吗？不介意的话，可以在这里坐一会儿。',
  waiting: '我在等一个很久没见的人。我们约好，旅行结束后在这里见面。可是咖啡馆快打烊了，我还没想好，要不要再等一会儿。',
  trust: '谢谢你。其实有人愿意陪着，等待就没有那么难了。这盏灯很暖，像我记忆里，海边那个小小的车站。',
  photo: '当然可以。这是我在海边拍的最后一张照片。那天没有人赶时间，只有一列慢慢开走的火车。我一直想把这张照片给他看。',
  departure: '你说得对，雨已经停了。也许有些重逢，不一定发生在约好的地方。等喝完这杯咖啡，我们就出去走走吧。',
  memory: '刚才那张照片，是我们一起去过的海边车站。我等的人，是陪我第一次旅行的朋友。我们很久没有联系，但我还记得那天的光。',
  followup: '我听见了。旅行的时候，我常常把没有说出口的话，留在照片里。今天能在这里慢慢聊一会儿，对我来说，是个很好的意外。',
} as const;

export function mockReply(text: string, story: Story): Performance & { audioId: keyof typeof mockLines } {
  if (/照片|相机|摄影|拍照|看看|拍过|风景/.test(text)) return {
    text: mockLines.photo, audioId: 'photo', emotion: 'wistful', story: 'photo',
    events: [{ on: 'speech_start', type: 'action', name: 'show_camera' }, { on: 'speech_start', type: 'media', name: 'travel_photo' }],
  };
  if (/出去|走吧|走走|雨停|离开|回家/.test(text)) return {
    text: mockLines.departure, audioId: 'departure', emotion: 'warm', story: 'departure',
    events: [{ on: 'speech_start', type: 'action', name: 'look_window' }, { on: 'speech_start', type: 'scene', name: 'rain_clears' }],
  };
  if (/陪|别担心|没关系|一起|不着急|不用着急|谢谢|暖|灯/.test(text)) return {
    text: mockLines.trust, audioId: 'trust', emotion: 'warm', story: story === 'departure' ? story : 'trust',
    events: [{ on: 'speech_start', type: 'scene', name: 'warm_light' }],
  };
  if (/等|为什么|谁|朋友/.test(text)) {
    if (story === 'photo') return { text: mockLines.memory, audioId: 'memory', emotion: 'wistful', story, events: [] };
    return { text: mockLines.waiting, audioId: 'waiting', emotion: 'guarded', story: 'waiting', events: [{ on: 'speech_start', type: 'action', name: 'look_window' }] };
  }
  if (story === 'arrival' || /你好|您好|名字|嗨/.test(text)) return { text: mockLines.greeting, audioId: 'greeting', emotion: 'calm', story, events: [] };
  return { text: mockLines.followup, audioId: 'followup', emotion: 'warm', story, events: [] };
}
