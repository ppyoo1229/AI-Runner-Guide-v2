import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Clock, Star, Route, Lightbulb, Trees, Users, Car, Coffee, Link as LinkIcon, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RunningCourse {
  id: string;
  name: string;
  description: string;
  start_lat: number;
  start_lng: number;
  distance_km: number;
  estimated_duration_minutes: number;
  difficulty_level: string;
  beginner_score: number;
  lighting_score: number;
  park_water_score: number;
  tags: string[];
  distance_from_user?: number;
  adjusted_score?: number;
  crew_friendly?: boolean;
  max_group_size?: number;
  parking_available?: boolean;
  facilities?: string[];
}

interface SearchResult {
  courses: RunningCourse[];
  search_params: any;
  total_found: number;
}

const DEPLOYMENT_LINKS_KEY = 'deployment_links';

interface DeploymentLink {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

const Index = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<RunningCourse[]>([]);
  const [searchParams, setSearchParams] = useState<any>(null);
  const { toast } = useToast();
  
  // 배포 링크 관련 상태
  const [deploymentLinks, setDeploymentLinks] = useState<DeploymentLink[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // 로컬 스토리지에서 배포 링크 불러오기
  useEffect(() => {
    const savedLinks = localStorage.getItem(DEPLOYMENT_LINKS_KEY);
    if (savedLinks) {
      try {
        setDeploymentLinks(JSON.parse(savedLinks));
      } catch (error) {
        console.error('Failed to parse deployment links:', error);
      }
    }
  }, []);

  // 배포 링크 저장
  const saveDeploymentLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      toast({
        title: "입력 오류",
        description: "이름과 URL을 모두 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    // URL 유효성 검사
    try {
      new URL(newLinkUrl);
    } catch {
      toast({
        title: "URL 오류",
        description: "올바른 URL 형식을 입력해주세요. (예: https://example.com)",
        variant: "destructive"
      });
      return;
    }

    const newLink: DeploymentLink = {
      id: Date.now().toString(),
      name: newLinkName.trim(),
      url: newLinkUrl.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedLinks = [...deploymentLinks, newLink];
    setDeploymentLinks(updatedLinks);
    localStorage.setItem(DEPLOYMENT_LINKS_KEY, JSON.stringify(updatedLinks));
    
    setNewLinkName('');
    setNewLinkUrl('');
    setIsDialogOpen(false);
    
    toast({
      title: "저장 완료",
      description: "배포 링크가 저장되었습니다."
    });
  };

  // 배포 링크 삭제
  const deleteDeploymentLink = (id: string) => {
    const updatedLinks = deploymentLinks.filter(link => link.id !== id);
    setDeploymentLinks(updatedLinks);
    localStorage.setItem(DEPLOYMENT_LINKS_KEY, JSON.stringify(updatedLinks));
    
    toast({
      title: "삭제 완료",
      description: "배포 링크가 삭제되었습니다."
    });
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "검색어를 입력해주세요",
        description: "예: '잠실 10km 크루 러닝 10명'",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // 타임아웃 설정 (30초)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')), 30000);
      });

      const searchPromise = supabase.functions.invoke('find_running_courses_enhanced_2025_11_19_11_13', {
        body: { query }
      });

      const { data, error } = await Promise.race([searchPromise, timeoutPromise]) as any;

      if (error) {
        // Supabase 에러 상세 정보 로깅
        console.error('Supabase error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          error: error.error,
          context: error.context
        });

        // 에러 타입에 따른 메시지 처리
        let errorMessage = "코스 검색 중 오류가 발생했습니다.";
        
        if (error.message?.includes('An unexpected error occurred')) {
          errorMessage = "서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
        } else if (error.message?.includes('timeout') || error.message?.includes('시간')) {
          errorMessage = "요청 시간이 초과되었습니다. 검색어를 간단하게 입력해주세요.";
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          errorMessage = "네트워크 연결을 확인해주세요.";
        } else if (error.message) {
          errorMessage = error.message;
        }

        throw new Error(errorMessage);
      }

      // 데이터 유효성 검사
      if (!data) {
        throw new Error("검색 결과를 받지 못했습니다. 다시 시도해주세요.");
      }

      const result: SearchResult = data;
      
      if (!result.courses || !Array.isArray(result.courses)) {
        throw new Error("검색 결과 형식이 올바르지 않습니다.");
      }

      setCourses(result.courses);
      setSearchParams(result.search_params);
      
      toast({
        title: "검색 완료",
        description: `${result.total_found}개의 코스를 찾았습니다.`
      });
    } catch (error: any) {
      console.error('Search error:', {
        message: error.message,
        stack: error.stack,
        error: error
      });
      
      const errorMessage = error.message || "코스 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      
      toast({
        title: "검색 실패",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyText = (level: string) => {
    switch (level) {
      case 'easy': return '초급';
      case 'medium': return '중급';
      case 'hard': return '고급';
      default: return level;
    }
  };

  const handleExampleSearch = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1"></div>
            <div className="flex-1 text-center">
              <h1 className="text-4xl font-bold italic text-gray-900 mb-4">
                🏃‍♂️ AI 러너 가이드
              </h1>
            </div>
            <div className="flex-1 flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <LinkIcon className="w-4 h-4" />
                    배포 링크
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>배포 사이트 링크 저장</DialogTitle>
                    <DialogDescription>
                      배포된 사이트 링크를 저장하고 관리할 수 있습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="link-name">이름</Label>
                      <Input
                        id="link-name"
                        placeholder="예: 프로덕션 배포"
                        value={newLinkName}
                        onChange={(e) => setNewLinkName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="link-url">URL</Label>
                      <Input
                        id="link-url"
                        type="url"
                        placeholder="https://example.com"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  {deploymentLinks.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="mb-2 block">저장된 링크</Label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {deploymentLinks.map((link) => (
                          <div key={link.id} className="flex items-center justify-between p-2 border rounded-lg">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{link.name}</div>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline truncate block"
                              >
                                {link.url}
                              </a>
                            </div>
                            <div className="flex gap-2 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(link.url, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteDeploymentLink(link.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button onClick={saveDeploymentLink}>저장</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <p className="text-lg text-gray-600 mb-6">
            초보 러너와 크루 러닝을 위한 맞춤형 코스 추천 서비스
          </p>
          
          {/* 검색 입력 */}
          <div className="flex gap-2 max-w-2xl mx-auto mb-4">
            <Input
              placeholder="예: 잠실 10km 크루 러닝 10명 모임"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
            </Button>
          </div>

          {/* 예시 검색어 */}
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="text-sm text-gray-500">예시:</span>
            {[
              '한강공원 3km 초보자',
              '강남역 근처 30분 야간',
              '올림픽공원 둘레길',
              '청계천 2km 평탄한',
              '잠실 10km 크루 러닝',
              '해운대 해변 15명 모임',
              '부산 광안리 야경 러닝',
              '송도 센트럴파크 그룹'
            ].map((example) => (
              <Button
                key={example}
                variant="outline"
                size="sm"
                onClick={() => handleExampleSearch(example)}
                className="text-xs"
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        {/* 검색 파라미터 표시 */}
        {searchParams && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">검색 조건</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {searchParams.location && (
                  <Badge variant="outline">
                    <MapPin className="w-3 h-3 mr-1" />
                    {searchParams.location}
                  </Badge>
                )}
                {searchParams.distance_km && (
                  <Badge variant="outline">
                    <Route className="w-3 h-3 mr-1" />
                    {searchParams.distance_km}km
                  </Badge>
                )}
                {searchParams.time_of_day && (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    {searchParams.time_of_day === 'morning' ? '아침' :
                     searchParams.time_of_day === 'afternoon' ? '오후' :
                     searchParams.time_of_day === 'evening' ? '저녁' :
                     searchParams.time_of_day === 'night' ? '야간' : searchParams.time_of_day}
                  </Badge>
                )}
                {searchParams.difficulty_level && (
                  <Badge variant="outline">
                    난이도: {getDifficultyText(searchParams.difficulty_level)}
                  </Badge>
                )}
                {searchParams.crew_friendly && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    <Users className="w-3 h-3 mr-1" />
                    크루 러닝
                  </Badge>
                )}
                {searchParams.crew_size && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">
                    <Users className="w-3 h-3 mr-1" />
                    {searchParams.crew_size}명
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 코스 목록 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{course.name}</CardTitle>
                  <div className="flex gap-1">
                    <Badge className={getDifficultyColor(course.difficulty_level)}>
                      {getDifficultyText(course.difficulty_level)}
                    </Badge>
                    {course.crew_friendly && (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Users className="w-3 h-3 mr-1" />
                        크루
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>{course.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* 기본 정보 */}
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center">
                      <Route className="w-4 h-4 mr-1" />
                      {course.distance_km}km
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {course.estimated_duration_minutes}분
                    </span>
                  </div>

                  {/* 크루 러닝 정보 */}
                  {course.crew_friendly && (
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center font-medium text-blue-800">
                          <Users className="w-4 h-4 mr-1" />
                          크루 러닝 적합
                        </span>
                        {course.max_group_size && (
                          <span className="text-blue-600">
                            최대 {course.max_group_size}명
                          </span>
                        )}
                      </div>
                      
                      {/* 편의시설 */}
                      {course.facilities && course.facilities.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {course.facilities.slice(0, 3).map((facility, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {facility === '주차장' && <Car className="w-3 h-3 mr-1" />}
                              {facility === '카페' && <Coffee className="w-3 h-3 mr-1" />}
                              {facility}
                            </Badge>
                          ))}
                          {course.facilities.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{course.facilities.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 점수 정보 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center text-sm">
                        <Star className="w-4 h-4 mr-1 text-yellow-500" />
                        {course.crew_friendly ? '크루 점수' : '초보자 점수'}
                      </span>
                      <span className="font-semibold text-yellow-600">
                        {(course.adjusted_score || course.beginner_score).toFixed(1)}점
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="flex items-center text-sm">
                        <Lightbulb className="w-4 h-4 mr-1 text-blue-500" />
                        조명 점수
                      </span>
                      <span className="text-blue-600">
                        {(course.lighting_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="flex items-center text-sm">
                        <Trees className="w-4 h-4 mr-1 text-green-500" />
                        자연 점수
                      </span>
                      <span className="text-green-600">
                        {(course.park_water_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* 거리 정보 */}
                  {course.distance_from_user && (
                    <div className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      현재 위치에서 {course.distance_from_user.toFixed(1)}km
                    </div>
                  )}

                  {/* 태그 */}
                  <div className="flex flex-wrap gap-1">
                    {course.tags.slice(0, 4).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1">
                      코스 보기
                    </Button>
                    <Button size="sm" variant="outline">
                      ❤️
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 빈 상태 */}
        {!loading && courses.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏃‍♂️</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              러닝 코스를 검색해보세요
            </h3>
            <p className="text-gray-500 mb-4">
              위치, 거리, 시간대, 크루 인원수를 자연어로 입력하면 맞춤형 코스를 추천해드립니다.
            </p>
            <div className="text-sm text-gray-400">
              <p>🌍 전국 주요 도시 지원: 서울, 부산, 대구, 대전, 광주, 인천, 울산, 제주</p>
              <p>👥 크루 러닝: 그룹 크기와 편의시설을 고려한 추천</p>
            </div>
          </div>
        )}

        {/* 푸터 */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>🚀 카카오 AI 오픈소스 프로젝트 | 카나나 LLM 기반 러닝 코스 추천</p>
          <p className="mt-1">🌍 전국 주요 도시 지원 | 👥 크루 러닝 특화 기능</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;