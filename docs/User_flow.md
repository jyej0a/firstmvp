flowchart TD
    %% 스타일 정의
    classDef start fill:#333,stroke:#333,stroke-width:2px,color:#fff;
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    classDef interaction fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef system fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px;

    Start((프로젝트 시작)):::start --> Login[1. 로그인<br>(관리자 인증)]:::process
    Login --> Main[2. 메인 대시보드]:::process

    subgraph Sourcing [소싱 단계]
        Main --> TrendShort{트렌드 확인(숏컷)}:::interaction
        TrendShort -->|숏컷 클릭| External[외부 사이트<br>(틱톡/아마존)]:::process
        External --> CopyURL[카테고리/키워드 확보]:::interaction
        CopyURL --> InputURL[3. 카테고리 입력 & 수집 요청]:::interaction
        InputURL --> SystemScrape[시스템: 50개 일괄 수집<br>+ 금지어 필터링]:::system
    end

    subgraph Processing [가공 단계]
        SystemScrape --> ListView[4. 작업대 (Workspace)]:::process
        ListView --> CheckFilter{소싱 결정}:::interaction
        
        CheckFilter -- 미국 소싱 --> US_Price[아마존 가격 기준 마진 적용]:::system
        CheckFilter -- 중국 소싱 --> ClickImg[이미지 클릭(타오바오 브릿지)]:::interaction
        ClickImg --> Taobao[타오바오 검색]:::process
        Taobao --> InputCost[원가 입력]:::interaction
        
        InputCost & US_Price --> Calc[판매가 자동 계산]:::system
        Calc --> CheckItem[등록할 상품 체크(V)]:::interaction
    end

    subgraph Registration [등록 단계]
        CheckItem --> ClickUpload[5. 등록 버튼 클릭(일괄 전송)]:::interaction
        ClickUpload --> Validate{데이터 검증}:::system
        Validate -->|실패| ErrorMsg[에러: 원가 미입력 등]:::error
        Validate -->|성공| UploadAPI[Shopify API 전송]:::system
        UploadAPI --> Complete((등록 완료)):::start
    end