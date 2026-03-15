nst FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop';

interface WeatherData {
  temperature: number;
  temperatureUnit: string;
  condition: string;
  description: string;
  icon: string;
  suggestIndoor: boolean;
  windSpeed: number;
}

function WeatherBanner({ lat, lng, cityName }: { lat: number; lng: number; cityName: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch(`/api/weather?lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setWeather(data);
      })
      .catch(() => {});
  }, [lat, lng]);

  if (!weather) return null;

  const bgClass = weather.suggestIndoor
    ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200'
    : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';

  const recommendation = weather.suggestIndoor
    ? 'Showing indoor-friendly spots first!'
    : weather.condition === 'clear'
      ? 'Perfect weather for outdoor spots!'
      : 'Enjoy exploring with your pup!';

  return (
    <div className={`rounded-xl border p-3 mb-4 flex items-center gap-3 ${bgClass}`}>
      <span className="text-2xl">{weather.icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">
            {weather.temperature}{weather.temperatureUnit}
          </span>
          <span className="text-gray-600 text-sm">{weather.description} in {cityName}</span>
        </div>
        <p className="text-sm text-gray-500">{recommendation}</p>
      </div>
      {weather.suggestIndoor && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
          Indoor recommended
        </span>
      )}
    </div>
  
 "½½½½±¸ì(Ý¥¹MÁè¹ÕµÈì)ô()Õ¹Ñ¥½¸]Ñ¡É	¹¹È¡ì±Ð°±¹°¥Ñå9µôèì±Ðè¹ÕµÈì±¹è¹ÕµÈì¥Ñå9µèÍÑÉ¥¹ô¤ì(½¹ÍÐmÝÑ¡È°ÍÑ]Ñ¡ÉtôÕÍMÑÑñ]Ñ¡ÉÑð¹Õ±°ø¡¹Õ±°¤ì((ÕÍÐ  ¤ôøì(Ñ ¡½Á¤½ÝÑ¡Èý±Ðôí±Ñô±½¸ôí±¹õ¤(¹Ñ¡¸¡ÉÌôøÉÌ¹©Í½¸ ¤¤(¹Ñ¡¸¡Ñôøì(¥ Ñ¹ÉÉ½È¤ÍÑ]Ñ¡È¡Ñ¤ì(ô¤(¹Ñ   ¤ôøíô¤ì(ô°m±Ð°±¹t¤ì((¥ ÝÑ¡È¤ÉÑÕÉ¸¹Õ±°ì((½¹ÍÐ
±ÍÌôÝÑ¡È¹ÍÕÍÑ%¹½½È(üµÉ¥¹ÐµÑ¼µÈÉ½´µ±Õ´ÔÀÑ¼µ±Õ´ÄÀÀ½ÉÈµ±Õ´ÈÀÀ(èµÉ¥¹ÐµÑ¼µÈÉ½´µµÈ´ÔÀÑ¼µ½É¹´ÔÀ½ÉÈµµÈ´ÈÀÀì((½¹ÍÐÉ½µµ¹Ñ¥½¸ôÝÑ¡È¹ÍÕÍÑ%¹½½È(üM¡½Ý¥¹¥¹½½ÈµÉ¥¹±äÍÁ½ÑÌ¥ÉÍÐ(èÝÑ¡È¹½¹¥Ñ¥½¸ôôô±È(üAÉÐÝÑ¡È½È½ÕÑ½½ÈÍÁ½ÑÌ(è¹©½äáÁ±½É¥¹Ý¥Ñ å½ÕÈÁÕÀì((ÉÑÕÉ¸ (ñ¥Ø±ÍÍ9µõíÉ½Õ¹µá°½ÉÈÀ´Ìµ´Ð±à¥ÑµÌµ¹ÑÈÀ´Ìí
±ÍÍõôø(ñÍÁ¸±ÍÍ9µôÑáÐ´Éá°ùíÝÑ¡È¹¥½¹ôð½ÍÁ¸ø(ñ¥Ø±ÍÍ9µô±à´Äø(ñ¥Ø±ÍÍ9µô±à¥ÑµÌµ¹ÑÈÀ´Èø(ñÍÁ¸±ÍÍ9µô½¹ÐµÍµ¥½±ÑáÐµÉä´äÀÀø(íÝÑ¡È¹ÑµÁÉÑÕÉõíÝÑ¡È¹ÑµÁÉÑÕÉU¹¥Ñô(ð½ÍÁ¸ø(ñÍÁ¸±ÍÍ9µôÑáÐµÉä´ØÀÀÑáÐµÍ´ùíÝÑ¡È¹ÍÉ¥ÁÑ¥½¹ô¥¸í¥Ñå9µôð½ÍÁ¸ø(ð½¥Øø(ñÀ±ÍÍ9µôÑáÐµÍ´ÑáÐµÉä´ÔÀÀùíÉ½µµ¹Ñ¥½¹ôð½Àø(ð½¥Øø(íÝÑ¡È¹ÍÕÍÑ%¹½½È (ñÍÁ¸±ÍÍ9µôÑáÐµáÌµ±Õ´ÄÀÀÑáÐµ±Õ´ÜÀÀÁà´ÈÁä´ÄÉ½Õ¹µÕ±°½¹Ðµµ¥Õ´Ý¡¥ÑÍÁµ¹½ÝÉÀø(%¹½½ÈÉ½µµ¹(ð½ÍÁ¸ø(¥ô(ð½¥Øø((ÜÜ	ÎÂÛÛÝ[TÝXZ]H

HOÂËÖÛ^WÙ[K\ÝBY rC ROESICH TSX FILE
}

  const bgClass = weather.suggestIndoor
    ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200'
    : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';

  const recommendation = weather.suggestIndoor
    ? 'Showing indoor-friendly spots first!'
    : weather.condition === 'clear'
      ? 'Perfect weather for outdoor spots!'
      : 'Enjoy exploring with your pup!';
