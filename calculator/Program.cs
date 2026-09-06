using osu.Game.Online.API;
using osu.Game.Rulesets.Osu.Difficulty;
using System.Reflection;
using System.Text.Json;
using osu.Game.Beatmaps;
using osu.Game.Beatmaps.Formats;
using osu.Game.Beatmaps.Legacy;
using osu.Game.IO;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Osu;
using osu.Game.Rulesets.Osu.Mods;
using osu.Game.Rulesets.Scoring;
using osu.Game.Scoring;

var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
try
{
    var request = await JsonSerializer.DeserializeAsync<Request>(Console.OpenStandardInput(), json)
        ?? throw new InvalidDataException("Missing calculator request.");
    using var stream = File.OpenRead(request.Beatmap);
    using var reader = new LineBufferedReader(stream);
    var beatmap = Decoder.GetDecoder<Beatmap>(reader).Decode(reader);
    var ruleset = new OsuRuleset();
    beatmap.BeatmapInfo.Ruleset = ruleset.RulesetInfo;
    var working = new FlatWorkingBeatmap(beatmap);
    Mod[] mods = request.LazerMods is { } lazerMods
        ? (Newtonsoft.Json.JsonConvert.DeserializeObject<APIMod[]>(lazerMods.GetRawText()) ?? []).Select(mod => mod.ToMod(ruleset)).ToArray()
        : [..ruleset.ConvertFromLegacyMods((LegacyMods)request.Mods), new OsuModClassic()];
    var calculator = ruleset.CreateDifficultyCalculator(working);
    using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(2));
    var timed = calculator.CalculateTimed(mods, timeout.Token);
    var attributes = calculator.Calculate(mods, timeout.Token);
    var performance = ruleset.CreatePerformanceCalculator();

    double Calculate(ScoreState state, DifficultyAttributes difficulty)
    {
        if (state.Count == 0) return 0;
        var score = new ScoreInfo(beatmap.BeatmapInfo, ruleset.RulesetInfo)
        {
            Mods = mods,
            MaxCombo = state.Combo,
            Accuracy = state.Accuracy ?? (6.0 * state.Great + 2.0 * state.Ok + state.Meh) / (6.0 * state.Count),
            LegacyTotalScore = state.LegacyScore,
            Statistics = new()
            {
                [HitResult.Great] = state.Great,
                [HitResult.Ok] = state.Ok,
                [HitResult.Meh] = state.Meh,
                [HitResult.Miss] = state.Miss,
                [HitResult.LargeTickHit] = state.LargeTickHit,
                [HitResult.LargeTickMiss] = state.LargeTickMiss,
                [HitResult.SliderTailHit] = state.SliderTailHit + Math.Max(0, ((OsuDifficultyAttributes)difficulty).SliderCount - state.SliderTailHit - state.SliderTailMiss),
            },
        };
        timeout.Token.ThrowIfCancellationRequested();
        return performance!.Calculate(score, difficulty).Total;
    }

    // Each snapshot contains completed top-level judgements. Slider ticks do not advance difficulty.
    var pp = request.Snapshots.Select(state => state.Count == 0 ? 0 :
        Calculate(state, timed[Math.Clamp(state.Count - 1, 0, timed.Count - 1)].Attributes)).ToArray();
    var perfect = new ScoreState(beatmap.HitObjects.Count, 0, 0, 0, attributes.MaxCombo, null, SliderTailHit: ((OsuDifficultyAttributes)attributes).SliderCount, Accuracy: 1);
    var version = typeof(OsuRuleset).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
    await JsonSerializer.SerializeAsync(Console.OpenStandardOutput(), new
    {
        version, stars = attributes.StarRating, maxCombo = attributes.MaxCombo,
        maxPP = Calculate(perfect, attributes), scorePP = Calculate(request.Score, attributes), pp,
    }, json);
}
catch (Exception error)
{
    Console.Error.WriteLine(error.Message);
    Environment.ExitCode = 1;
}

record Request(string Beatmap, int Mods, ScoreState Score, ScoreState[] Snapshots, JsonElement? LazerMods);
record ScoreState(int Great, int Ok, int Meh, int Miss, int Combo, long? LegacyScore, int LargeTickHit = 0, int LargeTickMiss = 0, int SliderTailHit = 0, int SliderTailMiss = 0, double? Accuracy = null)
{
    public int Count => Great + Ok + Meh + Miss;
}
