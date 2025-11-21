import { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Shield, Zap, Cloud, Thermometer, Users, Lightbulb, Car, Coffee, MessageCircle, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
interface RunningCourse {
  id: string;
  name: string;
  description: string;
  distance_km: number;
  estimated_duration_minutes: number;
  city: string;
  district: string;
  course_type: string;
  has_uphill: boolean;
  tags: string[];
  region_tags: string[];
  natural_tags: string[];
  safetyInfo?: SafetyInfo;
}

interface SafetyInfo {
  streetLights: number;
  securityLights: number;
  totalLights: number;
  lightDensity: number;
  safetyLevel: 'high' | 'medium' | 'low';
  facilities: string[];
  isNightSafe: boolean;
  isGroupFriendly: boolean;
}

interface WeatherInfo {
  location: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  windSpeed: number;
  visibility: number | null;
}
const Index = () => {
  const [courses, setCourses] = useState<RunningCourse[]>([]);
  const [loading, setLoading] = useState(false); // 초기에는 로딩하지 않음
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [filteredCourses, setFilteredCourses] = useState<RunningCourse[]>([]);
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [isNaturalSearch, setIsNaturalSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // 검색 여부 추적
  const [chatMessages, setChatMessages] = useState<Array<{type: 'user' | 'assistant', content: string, timestamp: Date}>>([]);
  
  // 예시 검색어
  const exampleQueries = [
    "오늘 인하대 근처에서 가볍게 뛰고 싶어",
    "잠실쪽 한 5키로..? 뛸만한 코스가 있나",
    "딱 왕복 1시간만 뛸 코스 추천 좀",
    "해운대임",
    "내일 한강에서 10km 야간런닝 괜찮을까?"
  ];

  // 코스 데이터는 검색할 때만 로드
  const fetchCourses = async () => {
    if (courses.length > 0) return; // 이미 로드된 경우 스킵
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('running_courses_2025_11_20_10_07')
        .select('*')
        .order('distance_km', { ascending: true });
      
      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('코스 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 자연어 검색 처리 (채팅 스타일)
  const handleNaturalSearch = async () => {
    if (!searchQuery.trim()) return;
    
    // 사용자 메시지 추가
    const userMessage = {
      type: 'user' as const,
      content: searchQuery,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);
    
    setSearching(true);
    setIsNaturalSearch(true);
    setHasSearched(true);
    
    // 코스 데이터 로드 (필요시)
    await fetchCourses();
    
    try {
      // 1. 자연어 쿼리 파싱
      const parseResponse = await supabase.functions.invoke('parse_running_query_advanced_2025_11_20_10_07', {
        body: { 
          query: searchQuery
        }
      });
      
      if (parseResponse.error) throw parseResponse.error;
      
      const { parsed, weather } = parseResponse.data;
      setWeatherInfo(weather);
      
      // 2. 파싱된 정보로 코스 검색 (위치 기반)
      const searchResponse = await supabase.functions.invoke('search_courses_location_based_2025_11_20_10_07', {
        body: {
          parsed: parsed
        }
      });
      
      if (searchResponse.error) throw searchResponse.error;
      
      const foundCourses = searchResponse.data.courses || [];
      const userLocation = searchResponse.data.userLocation || null;
      setFilteredCourses(foundCourses);
      
      // AI 응답 메시지 생성
      let assistantResponse = generateAssistantResponse(parsed, foundCourses, weather, userLocation);
      
      const assistantMessage = {
        type: 'assistant' as const,
        content: assistantResponse,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('자연어 검색 실패:', error);
      
      const errorMessage = {
        type: 'assistant' as const,
        content: '죄송해요, 검색 중 오류가 발생했어요. 다시 시도해주세요.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      
      // 실패 시 기본 필터링으로 폴백
      await fetchCourses();
      handleBasicFilter();
    } finally {
      setSearching(false);
      setSearchQuery(''); // 검색 후 입력창 초기화
    }
  };
  
  // AI 응답 생성 함수
  const generateAssistantResponse = (parsed: any, courses: RunningCourse[], weather: WeatherInfo | null, userLocation: any = null) => {
    let response = '';
    
    // 날씨 정보
    if (weather) {
      const isGoodWeather = weather.temperature >= 10 && weather.temperature <= 25;
      response += `🌤️ ${weather.location} 날씨: ${weather.temperature}°C, ${weather.description}\n`;
      response += isGoodWeather ? '러닝하기 좋은 날씨네요!\n\n' : '날씨를 고려해서 러닝하세요.\n\n';
    }
    
    // 검색 결과
    if (courses.length === 0) {
      response += '😅 조건에 맞는 코스를 찾지 못했어요.\n다른 지역이나 조건으로 다시 검색해보시겠어요?';
    } else {
      response += `🏃‍♂️ ${courses.length}개 코스를 찾았어요!\n\n`;
      
      // 상위 3개 코스 요약
      courses.slice(0, 3).forEach((course, index) => {
        response += `${index + 1}. ${course.name}\n`;
        let locationInfo = `📍 ${course.city} ${course.district} | 편도 ${course.distance_km}km | ${course.estimated_duration_minutes}분`;
        
        // 사용자 위치에서의 거리 표시
        if (course.distanceFromUser !== undefined) {
          locationInfo += ` | 내 위치에서 ${course.distanceFromUser.toFixed(1)}km`;
        }
        
        response += `${locationInfo}\n`;
        
        if (course.safetyInfo) {
          const features = [];
          if (course.safetyInfo.isNightSafe) features.push('야간러닝⭐');
          if (course.safetyInfo.isGroupFriendly) features.push('크루러닝👥');
          if (features.length > 0) {
            response += `${features.join(' ')}\n`;
          }
        }
        response += '\n';
      });
      
      if (courses.length > 3) {
        response += `외 ${courses.length - 3}개 코스가 더 있어요. 아래에서 확인해보세요! 👇`;
      }
    }
    
    return response;
  };
  
  // 기본 필터링 로직
  const handleBasicFilter = async () => {
    await fetchCourses(); // 코스 데이터 로드
    
    let filtered = courses;

    // 검색어 필터
    if (searchQuery && !isNaturalSearch) {
      filtered = filtered.filter(course => 
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.district.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 지역 필터
    if (selectedCity !== 'all') {
      filtered = filtered.filter(course => course.city === selectedCity);
    }

    // 코스 유형 필터
    if (selectedType !== 'all') {
      filtered = filtered.filter(course => course.course_type === selectedType);
    }
    
    setFilteredCourses(filtered);
    setHasSearched(true);
  };
  
  // 필터링 로직 (검색하지 않은 상태에서는 실행하지 않음)
  useEffect(() => {
    if (!isNaturalSearch && hasSearched) {
      handleBasicFilter();
    }
  }, [courses, searchQuery, selectedCity, selectedType, isNaturalSearch, hasSearched]);
  
  // 검색 초기화
  const resetSearch = () => {
    setSearchQuery('');
    setIsNaturalSearch(false);
    setWeatherInfo(null);
    setFilteredCourses([]);
    setHasSearched(false);
    setChatMessages([]);
  };
  
  // 전체 데이터 처리 (임시)
  const processAllCourses = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('process_all_courses_2025_11_20_10_07', {
        body: {}
      });
      
      if (response.error) {
        console.error('데이터 처리 오류:', response.error);
        alert('데이터 처리에 실패했습니다.');
      } else {
        console.log('데이터 처리 성공:', response.data);
        alert(`성공! 총 ${response.data.totalCourses}개 코스 중 ${response.data.insertedCourses}개가 저장되었습니다.`);
        // 데이터 새로고침
        await fetchCourses();
      }
    } catch (error) {
      console.error('데이터 처리 오류:', error);
      alert('데이터 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 코스 좌표 업데이트 (카카오맵 API)
  const updateCoordinates = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('update_course_coordinates_2025_11_20_10_07', {
        body: {}
      });
      
      if (response.error) {
        console.error('좌표 업데이트 오류:', response.error);
        alert('좌표 업데이트에 실패했습니다.');
      } else {
        console.log('좌표 업데이트 성공:', response.data);
        alert(`성공! ${response.data.message}`);
        // 데이터 새로고침
        setCourses([]);
        await fetchCourses();
      }
    } catch (error) {
      console.error('좌표 업데이트 오류:', error);
      alert('좌표 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 지역 태그 업데이트 (카카오맵 주소 파싱)
  const updateRegionTags = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('update_region_tags_from_kakao_2025_11_20_10_07', {
        body: {}
      });
      
      if (response.error) {
        console.error('지역 태그 업데이트 오류:', response.error);
        alert('지역 태그 업데이트에 실패했습니다.');
      } else {
        console.log('지역 태그 업데이트 성공:', response.data);
        alert(`성공! ${response.data.message}`);
        // 데이터 새로고침
        setCourses([]);
        await fetchCourses();
      }
    } catch (error) {
      console.error('지역 태그 업데이트 오류:', error);
      alert('지역 태그 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 예시 검색어 클릭 처리
  const handleExampleClick = (example: string) => {
    setSearchQuery(example);
  };
  
  // 안전 점수 계산 (STEP 4)
  const computeSafetyScores = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('compute_course_safety_mapping_2025_11_20_10_07', {
        body: {}
      });
      
      if (response.error) {
        console.error('안전 점수 계산 오류:', response.error);
        alert('안전 점수 계산에 실패했습니다.');
      } else {
        console.log('안전 점수 계산 성공:', response.data);
        alert(`성공! ${response.data.message}`);
        // 데이터 새로고침
        setCourses([]);
        await fetchCourses();
      }
    } catch (error) {
      console.error('안전 점수 계산 오류:', error);
      alert('안전 점수 계산에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 안전 레벨에 따른 배지 색상
  const getSafetyBadgeClass = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return 'safety-high';
      case 'medium': return 'safety-medium';
      case 'low': return 'safety-low';
      default: return 'safety-low';
    }
  };
  
  // 안전 레벨 텍스트
  const getSafetyText = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high': return '안전함';
      case 'medium': return '보통';
      case 'low': return '주의';
      default: return '정보없음';
    }
  };

  // 고유 도시 목록 추출
  const uniqueCities = Array.from(new Set(courses.map(course => course.city)));
  const uniqueTypes = Array.from(new Set(courses.map(course => course.course_type)));
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">러닝 코스를 불러오는 중...</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/icon.png" alt="AI 러너 가이드" className="w-12 h-12 rounded-lg shadow-sm" />
              <h1 className="text-2xl font-bold gradient-text">AI 러너 가이드</h1>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 좌표 업데이트 버튼 */}
              <Button 
                onClick={updateCoordinates}
                variant="secondary"
                size="sm"
                disabled={loading}
                className="text-xs"
              >
                {loading ? '업데이트중...' : '좌표 업데이트'}
              </Button>
              
              {/* 지역 태그 업데이트 버튼 */}
              <Button 
                onClick={updateRegionTags}
                variant="secondary"
                size="sm"
                disabled={loading}
                className="text-xs"
              >
                {loading ? '태그업데이트중...' : '태그 업데이트'}
              </Button>
              
              {/* 안전 점수 계산 버튼 */}
              <Button 
                onClick={computeSafetyScores}
                variant="secondary"
                size="sm"
                disabled={loading}
                className="text-xs"
              >
                {loading ? '점수계산중...' : '점수 계산'}
              </Button>
              
              {/* 임시 데이터 처리 버튼 */}
              <Button 
                onClick={processAllCourses}
                variant="secondary"
                size="sm"
                disabled={loading}
                className="text-xs"
              >
                {loading ? '처리중...' : '데이터 처리'}
              </Button>
              
              {hasSearched && (
                <Button 
                  onClick={resetSearch}
                  variant="outline"
                  className="border-border"
                >
                  새 검색
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 - 채팅 스타일 */}
      <main className="flex-1 flex flex-col">
        {!hasSearched ? (
          // 초기 화면 - 예시 검색어
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-2xl mx-auto px-4 text-center">
              <div className="mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <img src="/images/icon.png" alt="AI 러너 가이드" className="w-16 h-16" />
                  <MessageCircle className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">안녕하세요! 🏃‍♂️</h2>
                <p className="text-muted-foreground mb-6">
                  어떤 러닝코스를 찾고 계신가요? 자연스럽게 말씨해주세요!
                </p>
              </div>
              
              {/* 예시 검색어 */}
              <div className="space-y-3 mb-8">
                <p className="text-sm text-muted-foreground font-medium">예시 질문들:</p>
                {exampleQueries.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    className="block w-full p-4 text-left bg-card/50 hover:bg-card border border-border rounded-lg transition-colors duration-200 hover:border-primary/50"
                  >
                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                      <span className="text-sm">{example}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // 검색 결과 화면
          <div className="flex-1 flex flex-col">
            {/* 채팅 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-4xl mx-auto space-y-4">
                {chatMessages.map((message, index) => (
                  <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-primary text-primary-foreground ml-12' 
                        : 'bg-card border border-border mr-12'
                    }`}>
                      {message.type === 'assistant' ? (
                        <div className="whitespace-pre-line text-sm leading-relaxed">
                          {message.content}
                        </div>
                      ) : (
                        <div className="text-sm">{message.content}</div>
                      )}
                      <div className={`text-xs mt-2 opacity-70 ${
                        message.type === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {searching && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border p-4 rounded-lg mr-12">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span className="text-sm text-muted-foreground">검색 중...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* 날씨 정보 */}
            {weatherInfo && (
              <div className="px-4 pb-4">
                <div className="max-w-4xl mx-auto">
                  <Card className="running-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Cloud className="w-5 h-5 text-primary" />
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">{weatherInfo.location}</span>
                            <div>{weatherInfo.temperature}°C, {weatherInfo.description}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">체감온도</span>
                            <div>{weatherInfo.feelsLike}°C</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">습도/바람</span>
                            <div>{weatherInfo.humidity}% / {weatherInfo.windSpeed}m/s</div>
                          </div>
                          <div className="text-xs">
                            러닝하기 {weatherInfo.temperature >= 10 && weatherInfo.temperature <= 25 ? '좋은' : '주의할'} 날씨
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            {/* 코스 목록 */}
            {filteredCourses.length > 0 && (
              <div className="px-4 pb-4">
                <div className="max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCourses.map((course) => (
                      <Card key={course.id} className="running-card hover:glow-effect transition-all duration-300 cursor-pointer">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base mb-1 text-foreground">{course.name}</CardTitle>
                              <CardDescription className="text-xs text-muted-foreground">
                                {course.city} {course.district}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {course.course_type}
                            </Badge>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-3 pt-0">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {course.description}
                          </p>
                          
                          {/* 코스 정보 */}
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-primary" />
                              <span>{course.distance_km}km</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-primary" />
                              <span>{course.estimated_duration_minutes}분</span>
                            </div>
                            {course.has_uphill && (
                              <div className="flex items-center gap-1">
                                <Zap className="w-3 h-3 text-yellow-500" />
                                <span>업힐</span>
                              </div>
                            )}
                          </div>
                          
                          {/* 안전 정보 */}
                          {course.safetyInfo && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <Shield className="w-3 h-3 text-accent" />
                                  <span className="text-xs">안전도</span>
                                </div>
                                <Badge className={`text-xs ${getSafetyBadgeClass(course.safetyInfo.safetyLevel)}`}>
                                  {getSafetyText(course.safetyInfo.safetyLevel)}
                                </Badge>
                              </div>
                              
                              {/* 조명 정보 */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Lightbulb className="w-3 h-3" />
                                  <span>{course.safetyInfo.totalLights}개</span>
                                </div>
                                <div>
                                  <span>밀도 {course.safetyInfo.lightDensity}개/km</span>
                                </div>
                              </div>
                              
                              {/* 시설 및 특징 */}
                              <div className="flex flex-wrap gap-1">
                                {course.safetyInfo.isNightSafe && (
                                  <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                                    야간러닝
                                  </Badge>
                                )}
                                {course.safetyInfo.isGroupFriendly && (
                                  <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400">
                                    <Users className="w-3 h-3 mr-1" />
                                    크루러닝
                                  </Badge>
                                )}
                                {course.safetyInfo.facilities.slice(0, 2).map((facility, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {facility === '주차장' && <Car className="w-3 h-3 mr-1" />}
                                    {facility === '화장실' && <Coffee className="w-3 h-3 mr-1" />}
                                    {facility}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 기본 안전 정보 (상세 정보가 없을 때) */}
                          {!course.safetyInfo && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Shield className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">안전 정보</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                정보 없음
                              </Badge>
                            </div>
                          )}
                          
                          {/* 태그 */}
                          {course.natural_tags && course.natural_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {course.natural_tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* 채팅 입력창 */}
        <div className="border-t border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Input 
                  placeholder="러닝코스에 대해 무엇이든 물어보세요..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (isNaturalSearch) setIsNaturalSearch(false);
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleNaturalSearch()}
                  className="bg-background border-border pr-12"
                  disabled={searching}
                />
                <Button 
                  onClick={handleNaturalSearch}
                  disabled={!searchQuery.trim() || searching}
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>;
};
export default Index;