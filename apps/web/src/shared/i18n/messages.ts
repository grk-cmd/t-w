/** 화면 글 한 벌 — 언어마다 같은 모양(빠진 칸은 타입 검사가 잡는다). 영어 · 일본어는 원어민 검수 전이다. */
export interface Feature {
  icon: string;
  label: string;
  sub: string;
  text: string;
}

export interface Messages {
  siteName: string;
  metaTitle: string;
  metaDescription: string;
  skipToContent: string;
  navLabel: string;
  navMaker: string;
  navAbout: string;
  navHelp: string;
  navDownload: string;
  langLabel: string;
  heroEyebrow: string;
  heroTitleA: string;
  heroTitleB: string;
  heroLead1: string;
  heroLead2: string;
  heroCtaDownload: string;
  heroCtaMaker: string;
  heroNote: string;
  makerTitle: string;
  makerLead: string;
  makerWinTitle: string;
  makerSoon: string;
  makerSoonSub: string;
  aboutTitle: string;
  aboutLead: string;
  aboutWinTitle: string;
  aboutListLabel: string;
  features: readonly Feature[];
  dlTitle: string;
  dlLead: string;
  dlWinTitle: string;
  dlWindows: string;
  dlMac: string;
  dlSoon: string;
  specOs: string;
  specOsValue: string;
  specJoin: string;
  specJoinValue: string;
  talkWinTitle: string;
  talkLead: string;
  footerPrivacy: string;
  footerHelp: string;
}

export const ko: Messages = {
  siteName: '투게더워킹',
  metaTitle: '투게더워킹 — 책상 위의 작은 친구',
  metaDescription:
    '내가 만든 캐릭터와 함께 작업하는 Windows · macOS 데스크톱 컴패니언. 집중한 시간만큼 레벨이 오르고, 친구와 같은 방에서 일해요.',
  skipToContent: '본문으로 건너뛰기',
  navLabel: '메인 메뉴',
  navMaker: '캐릭터 만들기',
  navAbout: '소개',
  navHelp: '도움말',
  navDownload: '다운로드',
  langLabel: '언어',
  heroEyebrow: 'Windows · macOS 데스크톱 컴패니언',
  heroTitleA: '혼자서도 외롭지 않게,',
  heroTitleB: '투게더워킹!',
  heroLead1: '내가 만든 캐릭터와 함께 작업해요.',
  heroLead2: '집중한 시간만큼 레벨이 오르고, 새로운 보상이 열려요.',
  heroCtaDownload: '내려받기 ↓',
  heroCtaMaker: '캐릭터 만들어 보기 →',
  heroNote: '초대 코드가 있어야 가입할 수 있어요',
  makerTitle: '캐릭터 만들기',
  makerLead: '얼굴 · 머리 · 옷을 골라 나만의 캐릭터를 만들어요. 로그인 없이 해 볼 수 있어요.',
  makerWinTitle: '🎨 캐릭터 만들기',
  makerSoon: '웹에서 3D 로 캐릭터를 만드는 창을 준비하고 있어요.',
  makerSoonSub: '만든 캐릭터는 코드로 앱에 가져갈 수 있게 돼요.',
  aboutTitle: '책상 위에서 하는 일',
  aboutLead: '다른 프로그램 위에 켜 두어도 방해되지 않게 작고 조용하게.',
  aboutWinTitle: 'ℹ️ 소개',
  aboutListLabel: '기능 고르기',
  features: [
    {
      icon: '⏱',
      label: '집중',
      sub: '집중한 시간이 레벨이 돼요',
      text: '포커싱할 프로그램을 골라 두면 그 창을 쓰는 동안 시간이 쌓여요. 뽀모도로 · 주간 달성표 · 일정 알림도 있어요.',
    },
    {
      icon: '💼',
      label: '같이 일하는 방',
      sub: '같은 방 코드로 옆자리에',
      text: '워킹룸은 무료로 조용히, 투게더룸은 대화하며 함께. 최대 10명까지 들어와요.',
    },
    {
      icon: '🏠',
      label: '마이홈',
      sub: '나만의 미니홈피',
      text: '프로필 · 게시글 · 스티커 · 배경음악으로 꾸미고, 친구 홈에 놀러 가서 방명록을 남겨요.',
    },
    {
      icon: '🎨',
      label: '꾸미기',
      sub: '파츠를 하나씩 입혀요',
      text: '옷 · 소품 · 책상을 바꾸고 캡슐을 열어 새 파츠를 모아요. 동물 캐릭터는 Lv.50 에 열려요.',
    },
    {
      icon: '📷',
      label: '스티커사진',
      sub: '친구랑 한 컷',
      text: '방 친구들과 스티커사진을 찍고 꾸며서 남겨요.',
    },
    {
      icon: '🖐',
      label: '상호작용',
      sub: '쓰다듬고 흔들고 고정해요',
      text: '캐릭터를 쓰다듬고, 흔들고, 원하는 자세로 고정해요. 방에 있으면 상대 화면에도 같이 보여요.',
    },
  ],
  dlTitle: '내려받기',
  dlLead: '마음에 들었다면 지금 책상에 데려가요.',
  dlWinTitle: '💾 설치',
  dlWindows: 'Windows 내려받기',
  dlMac: 'macOS 내려받기',
  dlSoon: '웹에서 내려받기는 준비 중이에요. 초대받은 분께는 설치 안내를 따로 드려요.',
  specOs: '운영체제',
  specOsValue: 'Windows 10 이상 · macOS',
  specJoin: '가입',
  specJoinValue: '초대 코드 필요 · 지금은 새 초대장 발급을 잠시 멈췄어요',
  talkWinTitle: '💬 같이 이야기해요',
  talkLead: '쓰는 법 · 자주 묻는 질문은 도움말에서.',
  footerPrivacy: '개인정보 처리방침',
  footerHelp: '도움말',
};

export const en: Messages = {
  siteName: 'Together Working',
  metaTitle: 'Together Working — a little friend on your desk',
  metaDescription:
    'A desktop companion for Windows and macOS: work alongside a character you made. Level up as you focus, and work in the same room with friends.',
  skipToContent: 'Skip to content',
  navLabel: 'Main menu',
  navMaker: 'Character Maker',
  navAbout: 'About',
  navHelp: 'Help',
  navDownload: 'Download',
  langLabel: 'Language',
  heroEyebrow: 'Desktop companion for Windows · macOS',
  heroTitleA: 'Never alone at your desk —',
  heroTitleB: 'Together Working!',
  heroLead1: 'Work alongside a character you made yourself.',
  heroLead2: 'Focus longer to level up and unlock new rewards.',
  heroCtaDownload: 'Download ↓',
  heroCtaMaker: 'Make a character →',
  heroNote: 'An invite code is required to sign up',
  makerTitle: 'Character Maker',
  makerLead: 'Pick a face, hair and clothes to make your own character. No login needed.',
  makerWinTitle: '🎨 Character Maker',
  makerSoon: 'We are preparing a window to build your character in 3D on the web.',
  makerSoonSub: 'You will be able to bring it into the app with a code.',
  aboutTitle: 'What it does on your desk',
  aboutLead: 'Small and quiet, so it never gets in the way of your other apps.',
  aboutWinTitle: 'ℹ️ About',
  aboutListLabel: 'Choose a feature',
  features: [
    {
      icon: '⏱',
      label: 'Focus',
      sub: 'Focus time becomes your level',
      text: 'Pick the apps you focus in, and time adds up while you use them. Pomodoro, weekly goals and reminders included.',
    },
    {
      icon: '💼',
      label: 'Work rooms',
      sub: 'Same room code, side by side',
      text: 'Working Room is free and quiet; Together Room lets you chat. Up to 10 people per room.',
    },
    {
      icon: '🏠',
      label: 'My Home',
      sub: 'Your own mini homepage',
      text: 'Decorate it with a profile, posts, stickers and music, then visit friends and sign their guestbooks.',
    },
    {
      icon: '🎨',
      label: 'Dress-up',
      sub: 'Put on parts one by one',
      text: 'Change clothes, items and desks, and open capsules to collect new parts. Animal characters unlock at Lv.50.',
    },
    {
      icon: '📷',
      label: 'Sticker photos',
      sub: 'A snap with friends',
      text: 'Take sticker photos with your roommates and decorate them.',
    },
    {
      icon: '🖐',
      label: 'Interactions',
      sub: 'Pet, shake, and pin',
      text: 'Pet your character, shake it, or pin it in a pose. In a room, others see it on their screens too.',
    },
  ],
  dlTitle: 'Download',
  dlLead: 'Like it? Bring it to your desk now.',
  dlWinTitle: '💾 Install',
  dlWindows: 'Download for Windows',
  dlMac: 'Download for macOS',
  dlSoon: 'Downloading from the web is coming soon. Invited users receive install instructions separately.',
  specOs: 'OS',
  specOsValue: 'Windows 10 or later · macOS',
  specJoin: 'Sign-up',
  specJoinValue: 'Invite code required · new invites are paused for now',
  talkWinTitle: '💬 Talk with us',
  talkLead: 'How-tos and FAQs are in Help.',
  footerPrivacy: 'Privacy policy',
  footerHelp: 'Help',
};

export const ja: Messages = {
  siteName: 'トゥゲザーワーキング',
  metaTitle: 'トゥゲザーワーキング — デスクの上の小さな友だち',
  metaDescription:
    '自分で作ったキャラクターと一緒に作業する Windows・macOS 対応デスクトップコンパニオン。集中した時間だけレベルが上がり、友だちと同じ部屋で作業できます。',
  skipToContent: '本文へスキップ',
  navLabel: 'メインメニュー',
  navMaker: 'キャラクターメーカー',
  navAbout: '紹介',
  navHelp: 'ヘルプ',
  navDownload: 'ダウンロード',
  langLabel: '言語',
  heroEyebrow: 'Windows・macOS 対応デスクトップコンパニオン',
  heroTitleA: 'ひとりでも寂しくない、',
  heroTitleB: 'トゥゲザーワーキング!',
  heroLead1: '自分で作ったキャラクターと一緒に作業しよう。',
  heroLead2: '集中した時間だけレベルが上がり、新しいごほうびが解放されます。',
  heroCtaDownload: 'ダウンロード ↓',
  heroCtaMaker: 'キャラを作ってみる →',
  heroNote: '登録には招待コードが必要です',
  makerTitle: 'キャラクターメーカー',
  makerLead: '顔・髪・服を選んで、自分だけのキャラクターを作ろう。ログインなしで試せます。',
  makerWinTitle: '🎨 キャラクターメーカー',
  makerSoon: 'ウェブで 3D のキャラクターを作れるウィンドウを準備中です。',
  makerSoonSub: '作ったキャラクターはコードでアプリに持っていけるようになります。',
  aboutTitle: 'デスクの上でできること',
  aboutLead: 'ほかのアプリの上に置いても邪魔にならない、小さくて静かな存在。',
  aboutWinTitle: 'ℹ️ 紹介',
  aboutListLabel: '機能を選ぶ',
  features: [
    {
      icon: '⏱',
      label: '集中',
      sub: '集中した時間がレベルになる',
      text: '集中するアプリを選んでおくと、そのウィンドウを使っている間の時間がたまります。ポモドーロ・週間達成表・予定通知もあります。',
    },
    {
      icon: '💼',
      label: 'いっしょに作業する部屋',
      sub: '同じルームコードでとなりの席に',
      text: 'ワーキングルームは無料で静かに、トゥゲザールームはおしゃべりしながら。最大10人まで入れます。',
    },
    {
      icon: '🏠',
      label: 'マイホーム',
      sub: '自分だけのミニホームページ',
      text: 'プロフィール・投稿・ステッカー・BGMで飾って、友だちのホームに遊びに行って足あとを残そう。',
    },
    {
      icon: '🎨',
      label: '着せかえ',
      sub: 'パーツをひとつずつ着せる',
      text: '服・小物・デスクを替えて、カプセルを開けて新しいパーツを集めよう。動物キャラはLv.50で解放。',
    },
    {
      icon: '📷',
      label: 'プリクラ',
      sub: '友だちと一枚',
      text: 'ルームの友だちとプリクラを撮ってデコって残そう。',
    },
    {
      icon: '🖐',
      label: 'ふれあい',
      sub: 'なでて、ゆらして、固定する',
      text: 'キャラクターをなでたり、ゆらしたり、好きなポーズで固定したり。ルームにいると相手の画面にも表示されます。',
    },
  ],
  dlTitle: 'ダウンロード',
  dlLead: '気に入ったら、今すぐデスクに連れていこう。',
  dlWinTitle: '💾 インストール',
  dlWindows: 'Windows 版をダウンロード',
  dlMac: 'macOS 版をダウンロード',
  dlSoon: 'ウェブからのダウンロードは準備中です。招待された方にはインストール方法を別にお送りします。',
  specOs: '対応OS',
  specOsValue: 'Windows 10 以降・macOS',
  specJoin: '登録',
  specJoinValue: '招待コードが必要・現在、新しい招待状の発行を一時停止中',
  talkWinTitle: '💬 いっしょに話そう',
  talkLead: '使い方・よくある質問はヘルプで。',
  footerPrivacy: 'プライバシーポリシー',
  footerHelp: 'ヘルプ',
};
