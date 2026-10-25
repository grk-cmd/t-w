/** 화면 글 한 벌 — 언어마다 같은 모양(빠진 칸은 타입 검사가 잡는다). 영어 · 일본어는 원어민 검수 전이다. */
export interface Feature {
  icon: string;
  label: string;
  sub: string;
  text: string;
}

export interface CreatorMessages {
  loading: string;
  loadFailed: string;
  retry: string;
  noWebgl: string;
  previewLabel: string;
  exprOpen: string;
  exprClosed: string;
  texLabel: string;
  texHint: string;
  texIdle: string;
  tabAcc: string;
  eyeFolder: string;
  eyeFolderHint: string;
  eyeline: string;
  pupil: string;
  highlight: string;
  oddEye: string;
  accAdd: string;
  accList: string;
  accEmpty: string;
  accLoading: string;
  accLoadFailed: string;
  accNone: string;
  shapeLoading: string;
  shapeLoadFailed: string;
  shapeNone: string;
  accFull: string;
  accRemove: string;
  tabSkin: string;
  tabEyes: string;
  tabBrows: string;
  tabMouth: string;
  tabCheek: string;
  tabImage: string;
  tabCloth: string;
  shapeLabel: string;
  colorLabel: string;
  skinLabel: string;
  topLabel: string;
  botLabel: string;
  customColor: string;
  adjustLabel: string;
  sym: string;
  left: string;
  right: string;
  reset: string;
  adjX: string;
  adjY: string;
  adjS: string;
  adjR: string;
  random: string;
  undo: string;
  startOver: string;
  imageHint: string;
  imagePick: string;
  imageRemove: string;
  imageBad: string;
  imagePos: string;
  imageUnder: string;
  imageTop: string;
  imageOn: string;
  imageBoth: string;
  imageOpenOnly: string;
  imageClosedOnly: string;
  exportBtn: string;
  exportSub: string;
  exportTitle: string;
  exportPass: string;
  exportPass2: string;
  exportPassHint: string;
  exportPassMismatch: string;
  exportMake: string;
  exportMaking: string;
  exportFailed: string;
  exportCode: string;
  exportCopy: string;
  exportCopied: string;
  exportSave: string;
  exportSaved: string;
  exportHow: string;
  close: string;
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
  landName: string;
  landAria: string;
  landLocked: string;
  landSound: string;
  landOk: string;
  newsTitle: string;
  newsEmpty: string;
  makerTitle: string;
  makerLead: string;
  makerWinTitle: string;
  creator: CreatorMessages;
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
  heroCtaDownload: '내려받기',
  heroCtaMaker: '캐릭터 만들어 보기 →',
  heroNote: '초대 코드가 있어야 가입할 수 있어요',
  landName: '투게더랜드',
  landAria: '투게더랜드 (잠겨 있음)',
  landLocked: '이 문은 아직 잠겨 있어요.',
  landSound: '어딘가에서 새로운 땅을 짓는 소리가 들려요…',
  landOk: '확인',
  newsTitle: '📰 소식 · 업데이트',
  newsEmpty: '소식을 준비하고 있어요.',
  makerTitle: '캐릭터 만들기',
  makerLead:
    '얼굴 레이어를 골라 쌓고 옷 색을 고르면 기본 · 감은눈 얼굴이 함께 만들어져요. 로그인 없이 해 볼 수 있어요.',
  makerWinTitle: '🎨 캐릭터 만들기',
  creator: {
    loading: '캐릭터를 불러오는 중…',
    loadFailed: '캐릭터를 불러오지 못했어요. 잠시 뒤 다시 해 주세요.',
    retry: '다시 시도',
    noWebgl: '이 브라우저에서는 3D 미리보기를 열 수 없어요.',
    previewLabel: '만든 캐릭터 3D 미리보기 — 끌어서 돌려 보세요',
    exprOpen: '기본',
    exprClosed: '감은눈',
    texLabel: '얼굴 텍스처',
    texHint: '고른 레이어를 끌어서 옮겨요 (Shift: 가로 · 세로만)',
    texIdle: '눈 · 눈썹 · 입 · 볼 · 액세서리 탭에서 끌어 옮길 수 있어요',
    tabAcc: '액세서리',
    eyeFolder: '눈 (전체)',
    eyeFolderHint:
      '폴더를 옮기면 아이라인 · 하이라이트 · 동공이 함께 움직여요. 층을 고르면 그 층만 따로 옮겨요.',
    eyeline: '아이라인',
    pupil: '동공',
    highlight: '하이라이트',
    oddEye: '오드아이 (양쪽 다르게)',
    accAdd: '붙이기',
    accList: '붙인 것',
    accEmpty: '아직 붙인 액세서리가 없어요.',
    accLoading: '액세서리를 불러오는 중이에요…',
    accLoadFailed: '액세서리를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.',
    accNone: '아직 고를 수 있는 액세서리가 없어요.',
    shapeLoading: '모양을 불러오는 중이에요…',
    shapeLoadFailed: '모양을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.',
    shapeNone: '아직 고를 수 있는 모양이 없어요.',
    accFull: '최대 5개까지 붙일 수 있어요.',
    accRemove: '떼기',
    tabSkin: '피부',
    tabEyes: '눈',
    tabBrows: '눈썹',
    tabMouth: '입',
    tabCheek: '볼',
    tabImage: '내 그림',
    tabCloth: '옷 색',
    shapeLabel: '모양',
    colorLabel: '색',
    skinLabel: '피부',
    topLabel: '상의',
    botLabel: '하의',
    customColor: '다른 색',
    adjustLabel: '위치 · 크기 조정',
    sym: '⇔ 대칭',
    left: '왼쪽',
    right: '오른쪽',
    reset: '초기화',
    adjX: '좌우',
    adjY: '위아래',
    adjS: '크기',
    adjR: '회전',
    random: '🎲 랜덤',
    undo: '↶ 되돌리기',
    startOver: '처음부터',
    imageHint:
      '그림을 얼굴에 붙여요. 투명 배경 PNG 면 아래 얼굴이 비쳐 보여요. 네모가 아닌 그림은 가운데를 정사각형으로 잘라 써요. 그림은 이 브라우저 안에서만 쓰여요.',
    imagePick: '📂 그림 불러오기',
    imageRemove: '지우기',
    imageBad: '이 그림은 열 수 없어요(PNG · JPG · WebP).',
    imagePos: '쌓는 자리',
    imageUnder: '눈코입 아래',
    imageTop: '맨 위',
    imageOn: '붙일 얼굴',
    imageBoth: '둘 다',
    imageOpenOnly: '기본만',
    imageClosedOnly: '감은눈만',
    exportBtn: '앱으로 가져가기',
    exportSub: '코드 만들기',
    exportTitle: '앱으로 가져가기',
    exportPass: '비밀번호',
    exportPass2: '비밀번호 한 번 더',
    exportPassHint: '앱에서 코드를 넣을 때 이 비밀번호가 필요해요. 어디에도 저장하지 않아요.',
    exportPassMismatch: '두 비밀번호가 달라요.',
    exportMake: '코드 만들기',
    exportMaking: '만드는 중…',
    exportFailed: '코드를 만들지 못했어요. 다시 해 주세요.',
    exportCode: '캐릭터 코드',
    exportCopy: '복사',
    exportCopied: '복사했어요',
    exportSave: 'txt 파일로 저장',
    exportSaved: '저장했어요',
    exportHow:
      '앱 › 캐릭터 › «코드 입력하기» 에 붙여 넣거나 «📂 파일 불러오기» 로 txt 파일을 고른 뒤 비밀번호를 넣으면 이 캐릭터가 새 칸에 들어와요.',
    close: '닫기',
  },
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
  heroCtaDownload: 'Download',
  heroCtaMaker: 'Make a character →',
  heroNote: 'An invite code is required to sign up',
  landName: 'Together Land',
  landAria: 'Together Land (locked)',
  landLocked: 'This door is still locked.',
  landSound: 'You can hear something new being built somewhere…',
  landOk: 'OK',
  newsTitle: '📰 News · Updates',
  newsEmpty: 'News is on its way.',
  makerTitle: 'Character Maker',
  makerLead:
    'Stack face layers and pick clothing colors — the default and eyes-closed faces are made together. No login needed.',
  makerWinTitle: '🎨 Character Maker',
  creator: {
    loading: 'Loading the character…',
    loadFailed: "Couldn't load the character. Please try again in a moment.",
    retry: 'Try again',
    noWebgl: "This browser can't show the 3D preview.",
    previewLabel: 'Your character in 3D — drag to turn it',
    exprOpen: 'Default',
    exprClosed: 'Eyes closed',
    texLabel: 'Face texture',
    texHint: 'Drag the selected layer to move it (Shift: straight lines only)',
    texIdle: 'Open the Eyes, Brows, Mouth, Cheeks or Accessories tab to drag',
    tabAcc: 'Accessories',
    eyeFolder: 'Eyes (all)',
    eyeFolderHint:
      'Moving the folder moves the eyeline, highlight and pupil together. Pick a layer to move just that layer.',
    eyeline: 'Eyeline',
    pupil: 'Pupil',
    highlight: 'Highlight',
    oddEye: 'Odd eyes (different colors)',
    accAdd: 'Add',
    accList: 'Added',
    accEmpty: 'No accessories yet.',
    accLoading: 'Loading accessories…',
    accLoadFailed: "Couldn't load accessories. Please try again later.",
    accNone: 'No accessories to choose yet.',
    shapeLoading: 'Loading shapes…',
    shapeLoadFailed: "Couldn't load shapes. Please try again later.",
    shapeNone: 'No shapes to choose yet.',
    accFull: 'You can add up to 5.',
    accRemove: 'Remove',
    tabSkin: 'Skin',
    tabEyes: 'Eyes',
    tabBrows: 'Brows',
    tabMouth: 'Mouth',
    tabCheek: 'Cheeks',
    tabImage: 'My image',
    tabCloth: 'Clothes',
    shapeLabel: 'Shape',
    colorLabel: 'Color',
    skinLabel: 'Skin',
    topLabel: 'Top',
    botLabel: 'Bottom',
    customColor: 'Other color',
    adjustLabel: 'Position · Size',
    sym: '⇔ Mirror',
    left: 'Left',
    right: 'Right',
    reset: 'Reset',
    adjX: 'X',
    adjY: 'Y',
    adjS: 'Size',
    adjR: 'Rotate',
    random: '🎲 Random',
    undo: '↶ Undo',
    startOver: 'Start over',
    imageHint:
      'Put an image on the face. With a transparent PNG, the face shows through. Non-square images are cropped to a centered square. The image stays in this browser.',
    imagePick: '📂 Load image',
    imageRemove: 'Remove',
    imageBad: "This image can't be opened (PNG · JPG · WebP).",
    imagePos: 'Layer position',
    imageUnder: 'Under the features',
    imageTop: 'On top',
    imageOn: 'Apply to',
    imageBoth: 'Both',
    imageOpenOnly: 'Default only',
    imageClosedOnly: 'Eyes closed only',
    exportBtn: 'Bring it to the app',
    exportSub: 'Make a code',
    exportTitle: 'Bring it to the app',
    exportPass: 'Password',
    exportPass2: 'Password again',
    exportPassHint:
      'You will need this password when you enter the code in the app. It is not stored anywhere.',
    exportPassMismatch: "The passwords don't match.",
    exportMake: 'Make code',
    exportMaking: 'Making…',
    exportFailed: "Couldn't make the code. Please try again.",
    exportCode: 'Character code',
    exportCopy: 'Copy',
    exportCopied: 'Copied',
    exportSave: 'Save as .txt',
    exportSaved: 'Saved',
    exportHow:
      'In the app, go to Character › “Enter code”, paste it or pick the .txt file with “📂 Load file”, then type the password — the character arrives in a new slot.',
    close: 'Close',
  },
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
  heroCtaDownload: 'ダウンロード',
  heroCtaMaker: 'キャラを作ってみる →',
  heroNote: '登録には招待コードが必要です',
  landName: 'トゥゲザーランド',
  landAria: 'トゥゲザーランド(ロック中)',
  landLocked: 'この扉はまだ閉ざされています。',
  landSound: 'どこかで新しい土地をつくる音が聞こえる…',
  landOk: 'OK',
  newsTitle: '📰 お知らせ・アップデート',
  newsEmpty: 'お知らせを準備しています。',
  makerTitle: 'キャラクターメーカー',
  makerLead:
    '顔のレイヤーを重ねて服の色を選ぶと、通常と目閉じの顔が一緒に作られます。ログインなしで試せます。',
  makerWinTitle: '🎨 キャラクターメーカー',
  creator: {
    loading: 'キャラクターを読み込み中…',
    loadFailed: 'キャラクターを読み込めませんでした。少ししてからもう一度お試しください。',
    retry: 'もう一度',
    noWebgl: 'このブラウザでは 3D プレビューを表示できません。',
    previewLabel: '作ったキャラクターの 3D プレビュー — ドラッグで回せます',
    exprOpen: '通常',
    exprClosed: '目閉じ',
    texLabel: '顔テクスチャ',
    texHint: '選んだレイヤーをドラッグで移動(Shift:縦・横のみ)',
    texIdle: '目・眉・口・頬・アクセサリーのタブでドラッグして動かせます',
    tabAcc: 'アクセサリー',
    eyeFolder: '目(ぜんぶ)',
    eyeFolderHint:
      'フォルダを動かすとアイライン・ハイライト・瞳がいっしょに動きます。レイヤーを選ぶとそのレイヤーだけ動かせます。',
    eyeline: 'アイライン',
    pupil: '瞳',
    highlight: 'ハイライト',
    oddEye: 'オッドアイ(左右ちがう色)',
    accAdd: 'つける',
    accList: 'つけたもの',
    accEmpty: 'まだアクセサリーがありません。',
    accLoading: 'アクセサリーを読み込み中…',
    accLoadFailed: 'アクセサリーを読み込めませんでした。しばらくしてからもう一度開いてください。',
    accNone: 'まだ選べるアクセサリーがありません。',
    shapeLoading: '形を読み込み中…',
    shapeLoadFailed: '形を読み込めませんでした。しばらくしてからもう一度開いてください。',
    shapeNone: 'まだ選べる形がありません。',
    accFull: '5個までつけられます。',
    accRemove: 'はずす',
    tabSkin: '肌',
    tabEyes: '目',
    tabBrows: 'まゆ',
    tabMouth: '口',
    tabCheek: 'ほお',
    tabImage: '自分の画像',
    tabCloth: '服の色',
    shapeLabel: '形',
    colorLabel: '色',
    skinLabel: '肌',
    topLabel: 'トップス',
    botLabel: 'ボトムス',
    customColor: 'ほかの色',
    adjustLabel: '位置・サイズ調整',
    sym: '⇔ 左右対称',
    left: '左',
    right: '右',
    reset: 'リセット',
    adjX: '左右',
    adjY: '上下',
    adjS: 'サイズ',
    adjR: '回転',
    random: '🎲 ランダム',
    undo: '↶ 元に戻す',
    startOver: '最初から',
    imageHint:
      '画像を顔に貼り付けます。背景が透明な PNG なら下の顔が透けて見えます。正方形でない画像は中央を正方形に切り取って使います。画像はこのブラウザの中だけで使います。',
    imagePick: '📂 画像を読み込む',
    imageRemove: '削除',
    imageBad: 'この画像は開けません(PNG・JPG・WebP)。',
    imagePos: '重ねる位置',
    imageUnder: '目鼻口の下',
    imageTop: 'いちばん上',
    imageOn: '貼り付ける顔',
    imageBoth: '両方',
    imageOpenOnly: '通常のみ',
    imageClosedOnly: '目閉じのみ',
    exportBtn: 'アプリに持っていく',
    exportSub: 'コードを作る',
    exportTitle: 'アプリに持っていく',
    exportPass: 'パスワード',
    exportPass2: 'パスワード(もう一度)',
    exportPassHint: 'アプリでコードを入れるときにこのパスワードが必要です。どこにも保存しません。',
    exportPassMismatch: 'パスワードが一致しません。',
    exportMake: 'コードを作る',
    exportMaking: '作成中…',
    exportFailed: 'コードを作れませんでした。もう一度お試しください。',
    exportCode: 'キャラクターコード',
    exportCopy: 'コピー',
    exportCopied: 'コピーしました',
    exportSave: 'txtファイルで保存',
    exportSaved: '保存しました',
    exportHow:
      'アプリの キャラクター ›「コード入力」に貼り付けるか「📂 ファイルを読み込む」でtxtファイルを選び、パスワードを入れると、このキャラクターが新しい枠に入ります。',
    close: '閉じる',
  },
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
