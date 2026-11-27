// Extracted arithmetic diagnostic, not an original game run.
// Source 6882721: Biome.cpp347-365,423-480. Compile without contraction so the
// explicit float expressions are portable; normal CI uses its recorded samples.
#include <cmath>
#include <iomanip>
#include <iostream>
#include <vector>
using namespace std;
struct Row{float y0,y1,curve,gap;};
float easeIn(float a,float b,float p){return a+(b-a)*pow(p,2);}
float easeInOut(float a,float b,float p){const float PI=3.14159265358979323846264338327950288;return a+(b-a)*((-cos(p*PI)/2.f)+.5f);}
int main(){
 vector<Row> rows;int enter,hold,leave,mirror,distance;float curve,y;
 while(cin>>enter>>hold>>leave>>curve>>y>>mirror>>distance){
  float total=enter+hold+leave,first=rows.empty()?0:rows.back().y1;
  float dist=rows.empty()?distance:rows.back().gap;
  float increment=((mirror?24756:distance)-dist)/total,end=first+y*150.f;
  auto add=[&](float c,float h){rows.push_back({rows.empty()?0:rows.back().y1,h,c,dist});};
  for(int n=0;n<enter;n++){dist+=(int)increment;add(easeIn(0,curve,(float)n/enter),easeInOut(first,end,(float)n/total));}
  for(int n=0;n<hold;n++){dist+=(int)increment;add(curve,easeInOut(first,end,(float)(enter+n)/total));}
  for(int n=0;n<leave;n++){dist+=(int)increment;add(easeInOut(curve,0,(float)n/leave),easeInOut(first,end,(float)(enter+hold+n)/total));}
 }
 cout<<setprecision(9);
 for(size_t i=0;i<rows.size();i++){auto&r=rows[i];cout<<i<<" "<<r.y0<<" "<<r.y1<<" "<<r.curve<<" "<<r.gap<<"\n";}
}
