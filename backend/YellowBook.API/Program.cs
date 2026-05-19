using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using YellowBook.API.Data;
using YellowBook.API.Infrastructure;
using YellowBook.API.Repositories;
using YellowBook.API.Services;

EnvFileLoader.LoadFromRepoRoot(Directory.GetCurrentDirectory());

var builder = WebApplication.CreateBuilder(args);

var connectionString = ConnectionStringResolver.Resolve(builder.Configuration);
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "PostgreSQL connection missing. Set ConnectionStrings:DefaultConnection or DATABASE_URL (Neon/Supabase/Render web URL).");
}

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value!.Errors.Select(e => e.ErrorMessage).ToArray());

            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new
            {
                message = "Validation failed.",
                errors
            });
        };
    });

builder.Services.AddDbContext<YellowBookDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IBusinessRepository, BusinessRepository>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IReviewRepository, ReviewRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();

builder.Services.AddScoped<IBusinessService, BusinessService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IPdfService, PdfService>();
builder.Services.AddScoped<IContactService, ContactService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddSingleton<IImageStorageService, ImageStorageService>();

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? "YellowBook-Super-Secret-Key-Change-In-Production-2026!";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization(options => { options.FallbackPolicy = null; });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Yellow Book Telephone Directory API", Version = "v1" });
});

var corsOrigins = new List<string>
{
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
};
var extraOrigins = builder.Configuration["Cors:AllowedOrigins"] ?? builder.Configuration["FRONTEND_URL"];
if (!string.IsNullOrWhiteSpace(extraOrigins))
{
    corsOrigins.AddRange(extraOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}

builder.Services.AddCors(options =>
{
    var allowed = corsOrigins.Distinct().ToArray();
    options.AddPolicy("ReactApp", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                if (allowed.Contains(origin)) return true;
                return origin.EndsWith(".loca.lt", StringComparison.OrdinalIgnoreCase)
                    || origin.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)
                    || origin.EndsWith(".netlify.app", StringComparison.OrdinalIgnoreCase)
                    || origin.Contains("trycloudflare.com", StringComparison.OrdinalIgnoreCase)
                    || origin.Contains("loca.lt", StringComparison.OrdinalIgnoreCase)
                    || origin.Contains("onrender.com", StringComparison.OrdinalIgnoreCase);
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<YellowBookDbContext>();

    async Task RunPatchAsync(YellowBookDbContext database, string sql)
    {
        try { await database.Database.ExecuteSqlRawAsync(sql); }
        catch (Exception ex) { app.Logger.LogWarning(ex, "Schema patch skipped."); }
    }

    await RunPatchAsync(db, """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Payments' AND column_name = 'PayerName') THEN
                ALTER TABLE "Payments" ADD COLUMN "PayerName" character varying(150) NOT NULL DEFAULT '';
            END IF;
        END $$;
        """);
    await RunPatchAsync(db, """ALTER TABLE "Businesses" ADD COLUMN IF NOT EXISTS "IsFeatured" boolean NOT NULL DEFAULT false;""");
    await RunPatchAsync(db, """ALTER TABLE "Businesses" ADD COLUMN IF NOT EXISTS "IsApproved" boolean NOT NULL DEFAULT true;""");
    await RunPatchAsync(db, """ALTER TABLE "Businesses" ADD COLUMN IF NOT EXISTS "ImageUrlsJson" text;""");
    await RunPatchAsync(db, """ALTER TABLE "Businesses" ADD COLUMN IF NOT EXISTS "OpeningHoursJson" text;""");
    await RunPatchAsync(db, """ALTER TABLE "Businesses" ADD COLUMN IF NOT EXISTS "Latitude" double precision;""");
    await RunPatchAsync(db, """ALTER TABLE "Businesses" ADD COLUMN IF NOT EXISTS "Longitude" double precision;""");
    await RunPatchAsync(db, """
        CREATE TABLE IF NOT EXISTS "ContactMessages" (
            "Id" serial PRIMARY KEY,
            "Name" character varying(100) NOT NULL,
            "Email" character varying(150) NOT NULL,
            "Phone" character varying(30),
            "Subject" character varying(150) NOT NULL,
            "Message" character varying(2000) NOT NULL,
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
            "IsRead" boolean NOT NULL DEFAULT false
        );
        """);
    await RunPatchAsync(db, """
        CREATE TABLE IF NOT EXISTS "AnalyticsEvents" (
            "Id" serial PRIMARY KEY,
            "EventType" character varying(50) NOT NULL,
            "Path" character varying(300),
            "BusinessId" integer,
            "Meta" character varying(500),
            "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
        );
        """);

    try { await db.Database.MigrateAsync(); }
    catch (Exception ex) { app.Logger.LogWarning(ex, "EF migrate skipped."); }

    try
    {
        await DataSeeder.SeedAsync(db);
        await UserSeeder.SeedAdminAsync(scope.ServiceProvider);
        await SampleBusinessSeeder.EnsureAsync(db, app.Logger);
        await CloudinaryLogoSeeder.EnsureAsync(db, app.Logger);
    }
    catch (Exception seedEx)
    {
        app.Logger.LogWarning(seedEx, "Seeding partially skipped.");
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Database setup failed. API will start; restart after fixing DATABASE_URL.");
}

var enableSwagger =
    app.Environment.IsDevelopment()
    || string.Equals(Environment.GetEnvironmentVariable("ENABLE_SWAGGER"), "true", StringComparison.OrdinalIgnoreCase);

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Yellow Book API v1"));
}

var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads");
Directory.CreateDirectory(uploadsPath);

app.UseCors("ReactApp");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

var imageStorage = app.Services.GetRequiredService<IImageStorageService>();
app.Logger.LogInformation(
    imageStorage.IsCloudinaryEnabled
        ? "Cloudinary enabled — new uploads go to your Cloudinary account."
        : "Cloudinary not configured — run .\\scripts\\setup-cloudinary.ps1 to enable uploads.");

app.Run();
